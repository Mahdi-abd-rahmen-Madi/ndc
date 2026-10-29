export const styles = {
  optionBase: "px-3 py-2 text-xs flex items-center justify-between",
  optionDisabled: "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400",
  optionEnabled: "cursor-pointer hover:bg-violet-50 text-slate-700 hover:text-violet-900",
  optionSelected: "bg-violet-50 text-violet-700 font-semibold",
  
  optionLabel: "whitespace-nowrap pr-2",
  optionCheckIcon: "w-3.5 h-3.5 text-violet-600 shrink-0 ml-2",
  
  selectContainer: "relative w-full min-w-0",
  
  triggerBase: "w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 flex items-center justify-between cursor-pointer shadow-sm transition-all hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500",
  triggerDisabled: "opacity-50 cursor-not-allowed bg-slate-100",
  triggerEnabled: "hover:border-slate-400 focus:ring-2 focus:ring-violet-500/20",
  
  triggerValue: "truncate mr-2 font-medium text-xs text-slate-900",
  triggerIcon: "w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform",
  triggerIconOpen: "rotate-180 text-violet-600",
  
  dropdownMenu: "absolute z-[100] top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl custom-scrollbar ring-1 ring-black/5",
  emptyState: "p-3 text-xs text-slate-500 text-center",
  
  listContainer: "py-1 divide-y divide-slate-100",
  
  groupContainer: "mt-2 first:mt-0",
  groupLabel: "px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 border-b border-slate-100",
};
