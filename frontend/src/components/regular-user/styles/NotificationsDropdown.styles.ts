export const styles = {
  container: "relative",
  
  bellButton: "relative p-2 text-slate-600 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500",
  bellIcon: "w-5 h-5",
  
  badge: "absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white animate-pulse",
  
  dropdownMenu: "absolute right-0 mt-2 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-fadeIn",
  dropdownHeader: "p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0 z-10",
  dropdownTitle: "text-sm font-bold text-slate-900 flex items-center gap-2",
  dropdownTitleIcon: "w-4 h-4 text-violet-600",
  
  markAllReadBtn: "text-[10px] font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1 bg-violet-50 hover:bg-violet-100 border border-violet-100 px-2 py-1 rounded-md transition-colors",
  markAllReadIcon: "w-3 h-3",
  
  notificationsList: "overflow-y-auto flex-1 custom-scrollbar",
  
  emptyState: "p-8 text-center text-slate-400 flex flex-col items-center",
  emptyIcon: "w-8 h-8 mb-2 opacity-30 text-slate-400",
  emptyText: "text-sm text-slate-500",
  
  listContainer: "divide-y divide-slate-100",
  
  notificationItemBase: "p-4 hover:bg-slate-50 transition-colors group relative",
  notificationItemRead: "opacity-70 bg-white",
  notificationItemUnread: "bg-violet-50/30",
  
  unreadIndicator: "absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-violet-600",
  
  notificationContent: "pl-3",
  notificationHeader: "flex justify-between items-start gap-2",
  notificationTitleBase: "text-xs font-bold",
  notificationTitleRead: "text-slate-700",
  notificationTitleUnread: "text-slate-900",
  
  notificationTime: "text-[9px] text-slate-400 shrink-0 mt-0.5",
  notificationMessage: "text-[11px] text-slate-600 mt-1 leading-relaxed",
  
  actionsContainer: "flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity",
  actionBtnRead: "text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1",
  actionBtnDelete: "text-[10px] text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1",
  actionIcon: "w-3 h-3",
};
