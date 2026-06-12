"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatIcon } from "./icon";
import { Plus, Menu, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import Link from "next/link";
import { ROUTES } from "@/routers";
import {
  aiChatApi,
  createChatSession,
  getSessionHistory,
  saveChatMessage,
} from "@/routers/chat-api";
import { ChatHistory } from "./history";
import ReactMarkdown from "react-markdown";

export function ChatForm() {
  const {
    isOpen,
    toggleChat,
    session,
    chatSessions,
    addChatSession,
    resetSession,
    setSession,
    updateLastAIMessage,
  } = useChatStore((state) => state);
  const { isLogin, user } = useAuthStore((state) => state);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const fetchInitialMessages = async () => {
      if (session && isOpen) {
        try {
          if (chatSessions.length === 0) {
            const response = await getSessionHistory(session, { limit: 20 });
            const msgs = response.data.messages || [];
            const formattedMsgs = msgs.map((m) => ({
              id: m.id,
              role: m.role,
              message: m.content,
            }));

            setSession(session, formattedMsgs);
            setHasMore(msgs.length === 20);
          }
        } catch (error) {
          console.error("Lỗi lấy lịch sử chat:", error);
        }
      }
    };
    fetchInitialMessages();
  }, [session, isOpen, chatSessions.length, setSession]);

  const handleScroll = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container || !session || !hasMore || isFetchingRef.current) return;

    const isNearTop =
      container.scrollHeight + container.scrollTop <=
      container.clientHeight + 50;

    if (isNearTop) {
      isFetchingRef.current = true;
      setIsLoadingMore(true);

      try {
        const oldestMsgId = chatSessions[chatSessions.length - 1]?.id;

        if (oldestMsgId) {
          const response = await getSessionHistory(session, {
            limit: 20,
            lastId: oldestMsgId,
          });

          const newMsgs = response.data.messages || [];

          if (newMsgs.length > 0) {
            const formattedMsgs = newMsgs.map((m) => ({
              id: m.id,
              role: m.role,
              message: m.content,
            }));
            setSession(session, [...chatSessions, ...formattedMsgs]);
          }

          setHasMore(newMsgs.length === 20);
        }
      } catch (error) {
        console.error("Lỗi tải thêm tin nhắn:", error);
      } finally {
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    }
  }, [session, hasMore, chatSessions, setSession]);

  const handleInput = (e) => {
    setInputText(e.target.value);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const questionToAsk = inputText;
    setInputText("");

    setIsTyping(true);
    setIsThinking(true);

    // Scroll to bottom immediately
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 50);

    let currentSessionId = session;

    try {
      addChatSession({
        id: crypto.randomUUID(),
        role: "USER",
        message: questionToAsk,
      });

      if (!currentSessionId) {
        const newSessionData = await createChatSession({
          content: questionToAsk,
        });
        currentSessionId = newSessionData.data.session.id;
        setSession(currentSessionId, [
          {
            id: newSessionData.data.message.id,
            role: newSessionData.data.message.role,
            message: newSessionData.data.message.content,
          },
        ]);
      } else {
        saveChatMessage(currentSessionId, {
          role: "USER",
          content: questionToAsk,
        }).catch((err) => {
          console.error("Lỗi khi lưu tin nhắn USER:", err);
        });
      }

      let fullResponseText = "";
      let hasCreatedAIBubble = false;

      await aiChatApi(
        currentSessionId,
        questionToAsk,
        (newChunk) => {
          if (!hasCreatedAIBubble) {
            setIsThinking(false);
            addChatSession({
              id: crypto.randomUUID(),
              role: "AI",
              message: "",
            });
            hasCreatedAIBubble = true;
          }
          fullResponseText += newChunk;
          updateLastAIMessage(newChunk);
        },
        async () => {
          setIsTyping(false);
        },
        (error) => {
          console.log("Lỗi khi chat: ", error);
          setIsThinking(false);
          setIsTyping(false);
          if (!hasCreatedAIBubble) {
            addChatSession({
              id: crypto.randomUUID(),
              role: "AI",
              message: "(Lỗi kết nối. Vui lòng thử lại)",
            });
          } else {
            updateLastAIMessage("\n\n(Lỗi kết nối. Vui lòng thử lại)");
          }
        },
      );
    } catch (error) {
      console.error("Lỗi mạng hoặc server không phản hồi:", error);
      setIsThinking(false);
      setIsTyping(false);
      setInputText(questionToAsk);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 right-0 z-20">
      <div className="absolute bottom-0 right-0 flex flex-row-reverse gap-2">
        {isOpen && (
          <div
            className={`w-115 h-177 text-white rasa-font
        bg-linear-to-b from-[#B1CCFF] to-[#D2E2FF] rounded-tl-3xl`}
          >
            <header className="flex items-center justify-center h-20 text-[28px] font-bold">
              <span className="w-[85%] text-center truncate">MediCare Bot</span>
            </header>

            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex flex-col-reverse gap-2 h-135 overflow-y-scroll hide-scrollbar"
            >
              {!isLogin ? (
                <div className="w-full h-full flex items-center justify-center transition-all duration-300 px-8 text-center">
                  <div className="flex flex-col gap-4 items-center fade-in">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-2">
                       <ChatIcon className="text-white scale-150" />
                    </div>
                    <h2 className="text-white font-bold text-[24px] leading-tight">
                      Bạn cần đăng nhập để sử dụng trợ lý y tế
                    </h2>
                    <Link 
                      href={ROUTES.LOGIN}
                      className="bg-[#303EFF] text-white px-8 py-2 rounded-full font-bold hover:bg-[#1e27cc] transition-all"
                    >
                      Đăng nhập ngay
                    </Link>
                  </div>
                </div>
              ) : !session ? (
                <>
                  <div className="w-full h-full flex items-center transition-all duration-300 px-8">
                    <div className="flex flex-col rasa-font fade-in">
                      <h1 className="text-[#303EFF] font-bold text-[34px] leading-none">
                        Xin chào {user?.fullName || 'Hải Triều'}!
                      </h1>
                      <span className="text-[#5552FF] italic text-[22px]">
                        Hãy để tôi giải đáp mọi thắc mắc của bạn
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {isThinking && (
                    <div className="w-full flex gap-2 px-4">
                      <LogoMessage />
                      <div className="flex flex-col gap-2 animate-pulse">
                        <div className="max-w-75 bg-[#8380FF] rounded-2xl px-4 py-1 flex items-center">
                          Đang suy nghĩ{" "}
                          <MoreHorizontal className="ml-1 w-5 h-5 animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}

                  {chatSessions.map((chat) => (
                    <MessageForm
                      key={chat.id}
                      messageData={chat.message}
                      role={chat.role}
                    />
                  ))}

                  {isLoadingMore && (
                    <div className="w-full py-2 flex justify-center items-center text-white/70">
                      <MoreHorizontal className="animate-pulse" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="relative h-22 flex text-[16px]">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={!isLogin}
                placeholder={isLogin ? "Hỏi Medicare" : "Đăng nhập để đặt câu hỏi"}
                className={`
              absolute bottom-[30%] left-[50%] w-[90%] -translate-x-1/2
              min-h-10 max-h-30 rounded-3xl bg-[#8380FF] px-4 py-2.5
              focus:outline-none focus:ring-0
              resize-none overflow-hidden hide-scrollbar
              ${!isLogin && 'opacity-50 cursor-not-allowed'}
            `}
              />
            </div>
          </div>
        )}

        <div
          className={`flex flex-col gap-1 ${!isOpen && "mb-12 mr-7"} text-white`}
        >
          <ChatIcon onClick={toggleChat}>
            <Image
              width={46}
              height={46}
              src={"/images/Bot.svg"}
              alt="icon"
              className="mb-1"
            />
          </ChatIcon>

          {isOpen && isLogin && (
            <>
              <ChatIcon
                onClick={() => {
                  resetSession();
                }}
              >
                <Plus className="size-12" />
              </ChatIcon>

              <ChatIcon
                onClick={() => {
                  setHistoryOpen(true);
                }}
              >
                <Menu className="size-9" />
              </ChatIcon>
            </>
          )}
        </div>
      </div>

      {isHistoryOpen && <ChatHistory setHistoryOpen={setHistoryOpen} />}
    </div>
  );
}

function MessageForm({ messageData, role = "AI", haveObject = false }) {
  return (
    <div
      className={`w-full flex ${role === "USER" && "flex-row-reverse"} gap-2 px-4`}
    >
      <LogoMessage />
      <div className="flex flex-col gap-2">
        <TextMessage message={messageData} />
        {haveObject && <ObjectMessage />}
      </div>
    </div>
  );
}

function LogoMessage({ avatar = "/images/Avartar.jpg" }) {
  return (
    <div className="relative w-8 h-8 rounded-full overflow-hidden">
      <Image fill src={avatar} alt="" />
    </div>
  );
}

// Parse [DOCTOR_CARD id="..." name="..." specialty="..." avatar="..."] tags
function parseMessage(message) {
  const DOCTOR_CARD_REGEX =
    /\[DOCTOR_CARD\s+id="([^"]*?)"\s+name="([^"]*?)"\s+specialty="([^"]*?)"\s+avatar="([^"]*?)"\]/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = DOCTOR_CARD_REGEX.exec(message)) !== null) {
    // Text trước tag
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: message.slice(lastIndex, match.index) });
    }
    // Doctor card
    parts.push({
      type: "doctor_card",
      id: match[1],
      name: match[2],
      specialty: match[3],
      avatar: match[4],
    });
    lastIndex = match.index + match[0].length;
  }

  // Text còn lại sau tag cuối
  if (lastIndex < message.length) {
    parts.push({ type: "text", content: message.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: message }];
}

function DoctorCard({ id, name, specialty, avatar }) {
  const avatarSrc =
    avatar && avatar !== "None" && avatar !== "null" ? avatar : "/images/Avartar.jpg";

  return (
    <Link href={`${ROUTES.DOCTORS || "/doctors"}/${id}`}>
      <div className="flex items-center gap-3 bg-white/20 hover:bg-white/30 transition-all rounded-2xl px-3 py-2 cursor-pointer border border-white/30 mt-1">
        <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
          <Image
            fill
            src={avatarSrc}
            alt={name}
            onError={(e) => { e.target.src = "/images/Avartar.jpg"; }}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-white text-sm truncate">{name}</span>
          <span className="text-white/80 text-xs truncate">{specialty}</span>
        </div>
      </div>
    </Link>
  );
}

function TextMessage({ message = "" }) {
  const parts = parseMessage(message);

  return (
    <div className="max-w-75 bg-[#8380FF] rounded-2xl px-4 py-1 wrap-break-word">
      {parts.map((part, idx) =>
        part.type === "doctor_card" ? (
          <DoctorCard
            key={idx}
            id={part.id}
            name={part.name}
            specialty={part.specialty}
            avatar={part.avatar}
          />
        ) : (
          <ReactMarkdown key={idx}>{part.content}</ReactMarkdown>
        )
      )}
    </div>
  );
}

function ObjectMessage() {
  return (
    <div className="max-w-75 bg-[#8380FF] rounded-2xl px-4 py-1 wrap-break-word"></div>
  );
}

