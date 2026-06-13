"use client"

import { Trash2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

export function Table({
  columns = [{ key: "Bắt buộc", label: "Bắt buộc", mode: "tick/del/bỏ qua", width: "tùy chọn" }],
  data = [],
  isLoading = false,
  className = "",
  headerClassName = "",
  rowClassName = "",
  onRowClick = (rowData) => { },
  onTick = (isChecked, rowData) => { },
  onDelete = (rowData) => { },
}) {
  return (
    <div className={twMerge(
      "w-full max-h-150 min-h-20 overflow-y-auto rasa-font hide-scrollbar",
      className
    )}>
      <table className="w-full text-left text-[15px] table-fixed border-collapse">

        <thead className={twMerge(
          `sticky top-0 z-10 bg-[#4066FF] text-white font-bold`,
          headerClassName
        )}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 truncate align-middle"
                style={{ width: col.width }}
              >
                <span className="">{col.label}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={`skel-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#F1F4FF]"}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: col.width ? "60%" : "80%" }} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center italic text-gray-500 bg-white"
              >
                Chưa có nội dung để hiển thị
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              return (
                <tr
                  key={row.id || rowIndex}
                  className={twMerge(
                    `hover:bg-blue-50/50 transition-colors cursor-pointer`,
                    rowClassName
                  )}
                  onClick={() => onRowClick(row)}
                >
                  {columns.map((col) => {
                    return (
                      <td
                        key={col.key}
                        className="px-4 py-2 truncate"
                        onClick={(e) => {
                          if (col.onClick) {
                            e.stopPropagation();
                            col.onClick(row, col.key);
                          }
                        }}
                      >
                        {col.mode === "del" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(row);
                            }}
                            className={`text-red-500 cursor-pointer
                              opacity-80 hover:opacity-100
                              transition-all duration-300 ease-in-out
                              flex items-center
                            `}
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>

                        ) : col.mode === "tick" ? (
                          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!row[col.key]}
                              onChange={(e) => {
                                e.stopPropagation();
                                const isChecked = e.target.checked;
                                onTick(isChecked, row);
                              }}
                              className="w-[16px] h-[16px] cursor-pointer accent-blue-600 ite"
                            />
                          </div>

                        ) : (
                          <span className="text-gray-800">{row[col.key]}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>

      </table>
    </div>
  );
}