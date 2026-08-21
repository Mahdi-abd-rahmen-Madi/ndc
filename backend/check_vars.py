import os
import sys
from docxtpl import DocxTemplate

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_dir, "data", "Template NDC_modified.docx")
    doc = DocxTemplate(template_path)
    print("Variables in template:")
    print(doc.get_undeclared_template_variables())

if __name__ == "__main__":
    main()
