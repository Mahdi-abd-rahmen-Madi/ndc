export const styles = {
  container: "flex flex-col space-y-2 relative",
  
  headerContainer: "flex items-center justify-between mb-1",
  headerLabel: "text-xs font-semibold text-slate-700 flex items-center gap-1.5",
  headerIcon: "w-3.5 h-3.5 text-violet-600",
  
  mapButtonBase: "text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all",
  mapButtonActive: "bg-violet-100 text-violet-700 border border-violet-200 shadow-sm",
  mapButtonInactive: "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200",
  mapButtonIcon: "w-3 h-3 text-violet-600",
  
  searchContainer: "relative",
  searchIconContainer: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none",
  searchIconBase: "w-4 h-4",
  searchIconSearching: "text-violet-600 animate-pulse",
  searchIconIdle: "text-slate-400",
  
  searchInput: "w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all",
  
  dropdownContainer: "absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden py-1 divide-y divide-slate-100 ring-1 ring-black/5",
  dropdownButton: "w-full text-left px-4 py-2.5 hover:bg-violet-50 flex flex-col gap-0.5 transition-colors group",
  dropdownName: "text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors",
  dropdownAddress: "text-xs text-slate-500",
};
