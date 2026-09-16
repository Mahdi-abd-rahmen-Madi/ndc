import re

# RegularUserView.tsx
file1 = 'src/components/RegularUserView.tsx'
with open(file1, 'r') as f:
    content = f.read()

content = re.sub(r'const getCalculationHash =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const \[calculating, setCalculating\] = useState\(false\);\n', '', content)
content = re.sub(r'const \[pdfGenerating, setPdfGenerating\] = useState\(false\);\n', '', content)
content = re.sub(r'const handleTriggerCalculation = async.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const handleDownloadPdfWrap = async.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'\{uniqueGroups\.map\(\(group, groupIdx\) => \(', '{uniqueGroups.map((group) => (', content)

with open(file1, 'w') as f:
    f.write(content)

# FHEquipmentToggle.tsx
file2 = 'src/components/regular-user/FHEquipmentToggle.tsx'
with open(file2, 'r') as f:
    content = f.read()

content = re.sub(r'fhDiameter,\n', '', content)
content = re.sub(r'\{rrhItems\.map\(\(item, index\) => \(', '{rrhItems.map((item) => (', content)
content = re.sub(r'\{rruItems\.map\(\(item, index\) => \(', '{rruItems.map((item) => (', content)

with open(file2, 'w') as f:
    f.write(content)

# MontageSelector.tsx
file3 = 'src/components/regular-user/MontageSelector.tsx'
with open(file3, 'r') as f:
    content = f.read()

content = re.sub(r', Info', '', content)

with open(file3, 'w') as f:
    f.write(content)

# ResultsPanel.tsx
file4 = 'src/components/regular-user/ResultsPanel.tsx'
with open(file4, 'r') as f:
    content = f.read()

content = re.sub(r', Download', '', content)
content = re.sub(r', RefreshCw', '', content)
content = re.sub(r', useEffect', '', content)
content = re.sub(r'const \[isConverting, setIsConverting\] = useState\(false\);\n', '', content)
content = re.sub(r'const \[isDownloadingPdf, setIsDownloadingPdf\] = useState\(false\);\n', '', content)
content = re.sub(r'const handlePreviewDocument = async.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const handleDownloadDocumentPdf = async.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const \[pollingMsg, setPollingMsg\] = useState<string>\(.*?;\n', '', content)
content = re.sub(r'const handlePreviewTemplate = async.*?};\n', '', content, flags=re.DOTALL)

with open(file4, 'w') as f:
    f.write(content)

# UserInput.tsx
file5 = 'src/components/regular-user/UserInput.tsx'
with open(file5, 'r') as f:
    content = f.read()

content = re.sub(r', ShieldAlert', '', content)
content = re.sub(r'\s*siteType,\n', '\n', content)
content = re.sub(r'\s*plotHeight,\n', '\n', content)
content = re.sub(r'\s*setPlotHeight,\n', '\n', content)

with open(file5, 'w') as f:
    f.write(content)
