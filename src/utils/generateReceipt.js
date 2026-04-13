import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateReceipt = (data) => {
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
  doc.text('Recibo Oficial de Pago Académico', pageWidth / 2, 28, { align: 'center' });

  // Divider
  doc.setDrawColor(245, 166, 35); // Secondary Color
  doc.line(20, 35, pageWidth - 20, 35);

  // Info Section
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 45);
  doc.text(`Recibo N°: REC-${Math.floor(Math.random() * 100000)}`, pageWidth - 20, 45, { align: 'right' });

  // Details Table
  autoTable(doc, {
    startY: 55,
    head: [['Descripción', 'Detalle']],
    body: [
      ['Estudiante', data.student],
      ['Curso', data.course],
      ['Monto Abonado', `$${Number(data.amount).toLocaleString()}`],
      ['Método de Pago', data.payment_method === 'transfer' ? 'Transferencia' : 'Efectivo'],
      ['Estado', 'Validado'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [12, 30, 69] },
    margin: { left: 20, right: 20 },
  });

  // Footer & Disclaimer
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Este documento sirve como comprobante de pago manual registrado en el sistema.', 20, finalY);
  doc.text('Gracias por confiar en Fundetec Academy.', 20, finalY + 7);

  // QR / Code placeholder
  doc.rect(pageWidth - 50, finalY - 5, 30, 30);
  doc.setFontSize(8);
  doc.text('Sello Digital', pageWidth - 50, finalY + 30);

  // Save the PDF
  doc.save(`Recibo_Fundetec_${data.student.replace(/\s/g, '_')}.pdf`);
};
