import PDFDocument from 'pdfkit';
import { WeeklyReport, WaterAreaWeeklyStat } from '../types/interfaces';
import { DataStore } from '../store/DataStore';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';

export class PDFExporter {
  private store: DataStore;

  constructor(store: DataStore) {
    this.store = store;
  }

  exportWeeklyReport(report: WeeklyReport, outputPath?: string): Buffer {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (outputPath) {
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, buffer);
        }
        resolve(buffer);
      });
      doc.on('error', reject);

      this.renderReport(doc, report);
      doc.end();
    }) as any;
  }

  private renderReport(doc: PDFKit.PDFDocument, report: WeeklyReport) {
    doc.fontSize(24).text('钓鱼周报', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `第 ${report.weekNumber} 周 (${report.year})`,
        { align: 'center' }
      );
    doc
      .text(
        `周期: ${dayjs(report.startDate).format('YYYY-MM-DD')} ~ ${dayjs(report.endDate).format(
          'YYYY-MM-DD'
        )}`,
        { align: 'center' }
      );
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(16).text('一、水域鱼种分布', { underline: true });
    doc.moveDown(0.5);

    Object.values(report.waterAreaStats).forEach((stat: WaterAreaWeeklyStat, idx) => {
      doc.fontSize(13).text(`${idx + 1}. ${stat.waterAreaName}`);
      doc
        .fontSize(11)
        .text(
          `   总钓获: ${stat.totalCatches} 条 | 总重量: ${stat.totalWeight.toFixed(
            2
          )} kg | 平均: ${stat.avgWeight.toFixed(2)} kg`
        );

      const fishEntries = Object.entries(stat.fishDistribution).sort((a, b) => b[1] - a[1]);
      if (fishEntries.length > 0) {
        doc.text('   鱼种分布:');
        fishEntries.slice(0, 8).forEach(([fishId, count]) => {
          const fish = this.store.fishSpecies.get(fishId);
          const name = fish?.name || fishId;
          const pct = stat.totalCatches > 0 ? ((count / stat.totalCatches) * 100).toFixed(1) : '0';
          doc.text(`      - ${name}: ${count} 条 (${pct}%)`);
        });
      }
      doc.moveDown(0.3);
    });

    if (doc.y > 650) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(16).text('二、效率趋势', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11);
    report.efficiencyTrend.forEach((d) => {
      doc.text(
        `  ${d.date}: 平均 ${d.avgWeight.toFixed(2)} kg/条, 总钓获 ${d.totalCatches} 条`
      );
    });

    if (doc.y > 650) doc.addPage();
    doc.moveDown(0.8);
    doc.fontSize(16).text('三、烹饪消耗', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    const cookingEntries = Object.entries(report.cookingConsumption).sort((a, b) => b[1] - a[1]);
    if (cookingEntries.length === 0) {
      doc.text('  本周无烹饪记录');
    } else {
      cookingEntries.forEach(([dishId, count]) => {
        const dish = this.store.dishes.get(dishId);
        doc.text(`  ${dish?.name || dishId}: ${count} 份`);
      });
    }

    if (doc.y > 650) doc.addPage();
    doc.moveDown(0.8);
    doc.fontSize(16).text('四、本周 Top 10 钓手', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    report.topFishermen.forEach((f, i) => {
      doc.text(`  ${i + 1}. ${f.playerName} - ${f.totalWeight.toFixed(2)} kg`);
    });

    doc.moveDown(2);
    doc.fontSize(10).text('--- 报告生成时间: ' + new Date().toLocaleString('zh-CN'), {
      align: 'right',
    });
  }
}
