export const styles = {
  collapsedContainer: "bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-center justify-between",
  collapsedHeader: "text-sm font-bold text-slate-600 flex items-center gap-2",
  collapsedBadgeNumber: "flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold",
  collapsedTag: "text-xs text-violet-700 font-medium bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-md",
  
  mainContainer: "bg-white border border-slate-200 rounded-xl p-5 mb-6 relative overflow-hidden shadow-sm hover:border-violet-300 transition-all duration-300",
  mainDeco: "absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-full pointer-events-none",
  headerContainer: "flex items-center justify-between mb-5 border-b border-slate-100 pb-3",
  headerTitle: "text-lg font-bold text-slate-900 flex items-center gap-2",
  headerBadgeNumber: "flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold",
  
  contentSpace: "space-y-6",
  
  mastContainer: "flex flex-col space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden group hover:border-violet-300 transition-colors",
  mastDeco: "absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-bl-full -z-10 group-hover:bg-violet-500/10 transition-colors",
  mastLabel: "text-xs font-semibold text-slate-700 flex items-center justify-between",
  mastLabelInner: "flex items-center gap-1.5",
  mastIcon: "w-3.5 h-3.5 text-violet-600",
  
  mastInputsContainer: "flex flex-wrap items-end gap-6 mt-2",
  
  standardCol: "flex flex-col gap-1.5 min-w-[220px]",
  standardLabel: "text-xs font-medium text-slate-500 pl-1 mb-1",
  standardButtonsContainer: "flex gap-2 h-10",
  standardButtonBase: "flex-1 rounded-lg text-sm font-semibold transition-all",
  standardButtonActive: "bg-violet-600 text-white shadow-sm shadow-violet-500/20",
  standardButtonInactive: "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm",
  
  customCol: "flex flex-col gap-1.5 min-w-[160px]",
  customLabel: "text-xs font-medium text-slate-500 pl-1 mb-1",
  customInputContainer: "flex items-center gap-2 h-10",
  customInput: "w-full h-full bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all",
  customUnit: "text-slate-500 text-sm font-medium",
};
