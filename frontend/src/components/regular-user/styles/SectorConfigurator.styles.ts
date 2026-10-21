export const styles = {
  collapsedContainer: "bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-center justify-between",
  collapsedHeader: "text-sm font-bold text-slate-600 flex items-center gap-2",
  collapsedBadgeNumber: "flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold",
  collapsedTag: "text-xs text-violet-700 font-medium bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-md",
  
  mainContainer: "bg-white border border-slate-200 rounded-xl p-5 mb-6 relative shadow-sm hover:border-violet-300 transition-all duration-300",
  mainDeco: "absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-full pointer-events-none",
  headerContainer: "flex items-center justify-between mb-5 border-b border-slate-100 pb-3",
  headerTitle: "text-lg font-bold text-slate-900 flex items-center gap-2",
  headerBadgeNumber: "flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold",
  
  contentSpace: "space-y-6",
  
  mastContainer: "flex flex-col space-y-3 p-4 bg-slate-50/80 border border-slate-200 rounded-xl relative overflow-hidden group hover:border-violet-300 transition-all duration-300",
  mastContainerCustom: "flex flex-col space-y-3 p-4 bg-gradient-to-br from-amber-500/[0.05] via-amber-500/[0.02] to-orange-500/[0.06] border-2 border-amber-400 rounded-xl relative overflow-hidden group shadow-md shadow-amber-500/10 ring-2 ring-amber-400/25 transition-all duration-300",
  mastDecoStandard: "absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-bl-full -z-10 group-hover:bg-violet-500/10 transition-colors pointer-events-none",
  mastDecoCustom: "absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-amber-400/20 via-orange-400/10 to-transparent rounded-bl-full -z-10 animate-pulse pointer-events-none",
  mastLabel: "text-xs font-semibold text-slate-700 flex items-center justify-between",
  mastLabelInner: "flex items-center gap-1.5",
  mastIcon: "w-3.5 h-3.5 text-violet-600",
  mastIconCustom: "w-3.5 h-3.5 text-amber-600",
  
  mastInputsContainer: "flex flex-wrap items-end gap-6 mt-1",
  
  standardCol: "flex flex-col gap-1.5 min-w-[220px]",
  standardLabel: "text-xs font-medium text-slate-500 pl-1 mb-1",
  standardButtonsContainer: "flex gap-2 h-10",
  standardButtonBase: "flex-1 rounded-lg text-sm font-semibold transition-all",
  standardButtonActive: "bg-violet-600 text-white shadow-sm shadow-violet-500/20",
  standardButtonInactive: "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm",
  
  customCol: "flex flex-col gap-1.5 min-w-[160px]",
  customLabel: "text-xs font-medium text-slate-500 pl-1 mb-1 flex items-center justify-between",
  customLabelActive: "text-xs font-bold text-amber-700 pl-1 mb-1 flex items-center justify-between",
  customInputContainer: "flex items-center gap-2 h-10",
  customInput: "w-full h-full bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all",
  customInputActive: "w-full h-full bg-white border-2 border-amber-400 rounded-lg px-3 text-sm font-bold text-amber-950 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-sm shadow-amber-500/10 transition-all",
  customUnit: "text-slate-500 text-sm font-medium",
  customUnitActive: "text-amber-700 text-sm font-extrabold",
};
