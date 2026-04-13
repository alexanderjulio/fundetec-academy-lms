import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Exporta datos financieros a PDF con formato profesional.
 */
export const exportToPDF = (data, options = {}) => {
  const { 
    title = 'REPORTE FINANCIERO FUNDETEC', 
    filename = `reporte_fundetec_${new Date().getTime()}.pdf` 
  } = options;

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  // Estilo de encabezado
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Primary color
  doc.text(title, 14, 20);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado el: ${timestamp}`, 14, 28);

  const isLedger = data.length > 0 && 'student' in data[0];
  
  const tableHeaders = isLedger 
    ? [["Fecha", "Estudiante", "Programa", "Mentor", "Costo Total", "Pagado", "Saldo"]]
    : [["Fecha", "Entidad/Coordinador", "Descripción", "Monto (COP)", "Estado"]];

  const tableData = data.map(item => isLedger ? [
    item.date || '-',
    item.student || '-',
    item.course || '-',
    item.coordinator || 'Admin',
    `$${Number(item.total_cost).toLocaleString()}`,
    `$${Number(item.paid).toLocaleString()}`,
    `$${Number(item.balance).toLocaleString()}`
  ] : [
    item.date || '-',
    item.entity || 'Administración',
    item.description || '-',
    `$${Number(item.amount).toLocaleString()}`,
    item.status?.toUpperCase() || '-'
  ]);

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 35 },
  });

  doc.save(filename);
};

/**
 * Exporta datos financieros a Excel (.xlsx).
 */
export const exportToExcel = (data, options = {}) => {
  const { filename = `reporte_fundetec_${new Date().getTime()}.xlsx` } = options;
  const isLedger = data.length > 0 && 'student' in data[0];
  
  const formattedData = data.map(item => isLedger ? {
    "Fecha": item.date,
    "Estudiante": item.student,
    "Programa": item.course,
    "Mentor": item.coordinator,
    "Inversion Total": Number(item.total_cost),
    "Total Pagado": Number(item.paid),
    "Saldo": Number(item.balance)
  } : {
    "Fecha": item.date,
    "Coordinador/Entidad": item.entity || 'Administración',
    "Detalle": item.description,
    "Monto (COP)": Number(item.amount),
    "Estado": item.status?.toUpperCase()
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, isLedger ? "LibroMayor" : "Finanzas");

  // Ajustar anchos de columna básicos
  const wscols = isLedger 
    ? [{wch: 12}, {wch: 25}, {wch: 30}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}]
    : [{wch: 15}, {wch: 25}, {wch: 40}, {wch: 15}, {wch: 12}];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, filename);
};

/**
 * Exporta datos financieros a CSV.
 */
export const exportToCSV = (data, options = {}) => {
  const { filename = `reporte_fundetec_${new Date().getTime()}.csv` } = options;
  const isLedger = data.length > 0 && 'student' in data[0];
  
  const formattedData = data.map(item => isLedger ? {
    "Fecha": item.date,
    "Estudiante": item.student,
    "Programa": item.course,
    "Mentor": item.coordinator,
    "Total": item.total_cost,
    "Pagado": item.paid,
    "Saldo": item.balance
  } : {
    "Fecha": item.date,
    "Entidad": item.entity || 'Administración',
    "Descripcion": item.description,
    "Monto_COP": item.amount,
    "Estado": item.status
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
