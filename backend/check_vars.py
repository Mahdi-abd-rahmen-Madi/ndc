import sys
from docxtpl import DocxTemplate

def main():
    template_path = "/home/mahdi/CascadeProjects/ndc/backend/data/Template NDC_modified.docx"
    doc = DocxTemplate(template_path)
    print("Variables in template:")
    print(doc.get_undeclared_template_variables())

if __name__ == "__main__":
    main()
