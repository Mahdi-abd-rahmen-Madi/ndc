export const styles = {
  dimensionContainerRef: "flex flex-col",
  dimensionLabelRef: "text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold",
  dimensionValueBoxRef: "flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2",
  dimensionValueRef: "text-xs text-slate-800 font-mono font-medium",
  dimensionUnitRef: "text-[10px] text-slate-400",

  dimensionContainerInput: "flex flex-col",
  dimensionLabelInput: "text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold",
  dimensionInput: "w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 shadow-sm transition-all",

  mainContainer: "flex flex-col space-y-4",
  configContainer: "bg-slate-50/80 border border-slate-200 rounded-xl p-4",
  configHeader: "text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4",
  configIcon: "w-4 h-4 text-violet-600",

  segmentedControlContainer: "relative flex p-1 bg-slate-200/80 rounded-xl mb-5 border border-slate-300/80",
  segmentedControlSlider: "absolute inset-y-1 bg-white rounded-lg shadow-sm duration-300 ease-out",
  segmentedControlButtonBase: "relative flex-1 py-2 rounded-lg text-xs font-bold z-10 transition-colors",
  segmentedControlButtonActive: "text-violet-700",
  segmentedControlButtonInactive: "text-slate-600 hover:text-slate-900",

  gridContainer: "grid grid-cols-1 md:grid-cols-2 gap-4",

  antennaContainer: "bg-white border border-slate-200 hover:border-violet-300 transition-all rounded-xl p-4 shadow-sm",
  antennaHeader: "text-sm font-bold text-slate-800 mb-4 flex items-center gap-2",
  
  iconContainer4G: "w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center border border-blue-200",
  icon4G: "w-3.5 h-3.5 text-blue-600",
  iconContainer5G: "w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center border border-purple-200",
  icon5G: "w-3.5 h-3.5 text-purple-600",

  dropdownContainer: "mb-5",
  selectInput: "w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all hover:border-slate-400 cursor-pointer shadow-sm",
  dropdownCol: "flex flex-col gap-3",

  dimensionsGridContainer: "space-y-3",
  dimensionsGrid: "grid grid-cols-4 gap-2",
};
