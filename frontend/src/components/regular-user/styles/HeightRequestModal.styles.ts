export const styles = {
  overlay: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4",
  modalContainer: "bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scaleIn",
  
  header: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50",
  headerTitle: "text-lg font-bold text-slate-900 flex items-center gap-2",
  headerIcon: "w-5 h-5 text-amber-500",
  closeButton: "p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors",
  closeIcon: "w-5 h-5",
  
  form: "p-6",
  alertBox: "mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4",
  alertText: "text-sm text-amber-900 leading-relaxed",
  
  fieldsContainer: "space-y-4",
  gridContainer: "grid grid-cols-2 gap-4",
  
  label: "block text-xs font-semibold text-slate-700 mb-1",
  input: "w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-slate-900 focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm outline-none",
  textarea: "w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-slate-900 focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm outline-none resize-none",
  
  footer: "mt-8 flex justify-end gap-3",
  cancelButton: "px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200",
  submitButton: "px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-sm shadow-violet-500/20 disabled:opacity-50 transition-all",
  
  spinnerIcon: "animate-spin h-4 w-4 text-white",
  sendIcon: "w-4 h-4",
};
