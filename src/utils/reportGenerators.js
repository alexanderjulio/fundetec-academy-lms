import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Genera un reporte PDF profesional con jsPDF y AutoTable.
 */
export const generatePDFReport = (data, title, coordinatorName = 'Institución', preview = false) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();

  // Encabezado
  doc.setFontSize(22);
  doc.setTextColor(47, 75, 140); // primary-color
  doc.text('FUNDETEC ACADEMY', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`REPORTE: ${title.toUpperCase()}`, 14, 30);
  doc.text(`EMITIDO POR: ${coordinatorName}`, 14, 35);
  doc.text(`FECHA: ${date}`, 160, 35);

  // Tabla
  const tableColumn = ["Estudiante", "Email", "Programa", "Estado", "Mentor"];
  const tableRows = data.map(u => [
    u.full_name,
    u.email,
    u.student_type || 'N/A',
    u.status || 'Activo',
    u.coordinator?.full_name || 'Sin Asignar'
  ]);

  autoTable(doc, {
    startY: 45,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [47, 75, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  // Pie de página
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount} - Documento Oficial Fundetec`, 14, doc.internal.pageSize.height - 10);
  }

  if (preview) {
    return doc.output('bloburl');
  }

  doc.save(`Reporte_${title.replace(/\s+/g, '_')}_${date}.pdf`);
};

/**
 * Genera un archivo Excel (.xlsx) estructurado.
 */
export const generateExcelReport = (data, title) => {
  const date = new Date().toLocaleDateString();
  
  const worksheetData = data.map(u => ({
    "Nombre del Estudiante": u.full_name,
    "Correo Electrónico": u.email,
    "Modalidad": u.student_type || 'N/A',
    "Estado de Cuenta": u.status || 'Activo',
    "Mentor Asignado": u.coordinator?.full_name || 'Sin Asignar',
    "WhatsApp": u.whatsapp || 'N/A',
    "Fecha de Registro": new Date(u.created_at).toLocaleDateString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Estudiantes");

  // Ajustar anchos de columna básicos
  const wscols = [
    {wch:30}, {wch:30}, {wch:15}, {wch:15}, {wch:25}, {wch:15}, {wch:15}
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `Reporte_Estudiantes_${title.replace(/\s+/g, '_')}_${date}.xlsx`);
};
