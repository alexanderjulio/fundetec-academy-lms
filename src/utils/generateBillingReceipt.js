import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateBillingReceipt = (data) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(12, 30, 69); // Primary Color
  doc.text('FUNDETEC ACADEMY', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Recibo por Servicios de Plataforma (Coordinadores)', pageWidth / 2, 28, { align: 'center' });

  // Divider
  doc.setDrawColor(245, 166, 35); // Secondary Color
  doc.line(20, 35, pageWidth - 20, 35);

  // Info Section
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text(`Fecha Emisión: ${new Date(data.created_at).toLocaleDateString()}`, 20, 45);
  doc.text(`Factura N°: BILL-${data.id.slice(0,8).toUpperCase()}`, pageWidth - 20, 45, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Coordinador:', 20, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${data.coordinator?.full_name}`, 20, 62);
  doc.text(`Estado del Pago: ${data.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}`, 20, 69);

  // Students Table
  autoTable(doc, {
    startY: 80,
    head: [['Alumno', 'Fecha Registro', 'Costo Unit. (Ref)']],
    body: data.items.map(item => [
      item.student?.full_name || 'N/A',
      new Date(item.created_at).toLocaleDateString(),
      `$${Number(item.unit_price).toLocaleString()}`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [12, 30, 69] },
    margin: { left: 20, right: 20 },
  });

  // Totals Section
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(12, 30, 69);
  doc.text(`TOTAL NETO A PAGAR: $${Number(data.total_amount).toLocaleString()} COP`, pageWidth - 20, finalY, { align: 'right' });

  // Footer & Disclaimer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text('Este documento certifica el cobro por concepto de uso de plataforma educativa', 20, finalY + 20);
  doc.text('para los alumnos matriculados por el coordinador mencionado arriba.', 20, finalY + 27);

  // Save the PDF
  doc.save(`Recibo_Plataforma_${data.coordinator?.full_name.replace(/\s/g, '_')}_${data.id.slice(0,4)}.pdf`);
};
