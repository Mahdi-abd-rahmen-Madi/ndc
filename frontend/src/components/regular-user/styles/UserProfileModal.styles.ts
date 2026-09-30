export const styles = {
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4",
  modalContainer: "bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200",
  
  header: "p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50",
  headerTitle: "text-lg font-bold text-slate-900 flex items-center gap-2",
  headerIcon: "w-5 h-5 text-violet-600",
  closeButton: "text-slate-400 hover:text-slate-700 transition-colors p-1 hover:bg-slate-100 rounded-lg",
  closeIcon: "w-5 h-5",
  
  contentBody: "p-6 space-y-6",
  sectionContainer: "space-y-3",
  label: "text-sm font-semibold text-slate-800 block",
  description: "text-xs text-slate-500 mb-4",
  
  logoPreviewContainer: "relative group w-32 h-32 mx-auto rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 mb-6",
  removeLogoButton: "absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-md z-10 transition-colors",
  removeLogoIcon: "w-3 h-3",
  logoImage: "w-full h-full object-contain p-2",
  
  uploadContainer: "relative",
  fileInput: "absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed",
  
  uploadBoxBase: "w-full py-4 px-4 bg-slate-50 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 hover:border-violet-500 hover:bg-violet-50/20 group transition-colors",
  uploadBoxError: "border-red-400",
  uploadBoxSuccess: "border-emerald-400",
  uploadBoxDefault: "border-slate-300",
  
  loadingIcon: "w-6 h-6 text-violet-600 animate-spin",
  loadingText: "text-sm text-slate-600",
  
  uploadIconBase: "w-6 h-6",
  uploadIconError: "text-red-500",
  uploadIconDefault: "text-slate-400 group-hover:text-violet-600 transition-colors",
  
  uploadTitle: "text-sm font-medium text-slate-700",
  uploadSubtitle: "text-xs text-slate-400 text-center",
  
  errorMessage: "text-xs text-red-600 mt-2 text-center bg-red-50 py-2 rounded-lg border border-red-200",
  
  footer: "p-4 border-t border-slate-100 flex justify-end bg-slate-50/50",
  footerButton: "px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-violet-500/20",
};
