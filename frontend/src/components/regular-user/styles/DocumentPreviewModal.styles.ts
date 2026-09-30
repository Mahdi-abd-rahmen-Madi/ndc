export const styles = {
  overlay: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col",
  
  header: "h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm",
  headerLeft: "flex items-center gap-4",
  title: "text-slate-900 font-bold",
  
  externalLink: "text-xs flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800 transition-colors bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg border border-violet-100",
  externalLinkIcon: "w-3 h-3",
  
  closeButton: "p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors",
  closeIcon: "w-6 h-6",
  
  contentContainer: "flex-1 bg-slate-100 relative overflow-hidden",
  
  stateContainer: "absolute inset-0 flex flex-col items-center justify-center",
  
  convertingText: "text-slate-500",
  spinnerIcon: "w-12 h-12 animate-spin mb-4 text-violet-600",
  stateTitle: "text-lg font-medium text-slate-900 mb-2",
  stateSubtitle: "text-sm text-slate-500",
  
  failedText: "text-slate-600",
  errorIconBox: "w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-200",
  errorIcon: "w-8 h-8",
  errorDescription: "text-sm mb-6 max-w-md text-center text-slate-500",
  
  downloadLink: "px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-violet-500/20",
  downloadIcon: "w-5 h-5",
  
  iframe: "w-full h-full border-0 bg-white",
};
