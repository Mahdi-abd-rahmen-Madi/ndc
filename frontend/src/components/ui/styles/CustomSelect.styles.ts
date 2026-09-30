export const styles = {
  optionBase: "px-3 py-2 text-sm flex items-center justify-between",
  optionDisabled: "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400",
  optionEnabled: "cursor-pointer hover:bg-violet-50 text-slate-700 hover:text-violet-900",
  optionSelected: "bg-violet-50 text-violet-700 font-semibold",
  
  optionLabel: "truncate",
  optionCheckIcon: "w-4 h-4 text-violet-600 shrink-0 ml-2",
  
  selectContainer: "relative",
  
  triggerBase: "w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 text-sm text-slate-800 flex items-center justify-between cursor-pointer shadow-sm",
  triggerDisabled: "opacity-50 cursor-not-allowed bg-slate-100",
  triggerEnabled: "hover:border-violet-400 focus:ring-2 focus:ring-violet-500/20",
  
  triggerValue: "truncate mr-2 font-medium",
  triggerIcon: "w-4 h-4 text-slate-400 transition-transform",
  triggerIconOpen: "rotate-180 text-violet-600",
  
  dropdownMenu: "absolute z-[100] top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl custom-scrollbar ring-1 ring-black/5",
  emptyState: "p-3 text-xs text-slate-500 text-center",
  
  listContainer: "py-1 divide-y divide-slate-100",
  
  groupContainer: "mt-2 first:mt-0",
  groupLabel: "px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 border-b border-slate-100",
};
