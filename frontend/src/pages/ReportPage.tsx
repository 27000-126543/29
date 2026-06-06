import { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/client';
import ReactECharts from 'echarts-for-react';

interface WaterAreaWeeklyStat {
  waterAreaId: string;
  waterAreaName: string;
  fishDistribution: Record<string, number>;
  totalCatches: number;
  totalWeight: number;
  avgWeight: number;
}

interface EfficiencyTrendPoint {
  date: string;
  avgWeight: number;
  totalCatches: number;
}

interface TopFisherman {
  playerId: string;
  playerName: string;
  totalWeight: number;
}

interface WeeklyReport {
  weekNumber: number;
  year: number;
  startDate: number;
  endDate: number;
  waterAreaStats: Record<string, WaterAreaWeeklyStat>;
  efficiencyTrend: EfficiencyTrendPoint[];
  cookingConsumption: Record<string, number>;
  topFishermen: TopFisherman[];
}

const WATER_EMOJIS: Record<string, string> = {
  lake: '🏞️',
  river: '🌊',
  ocean: '🌅',
  guild: '🏰',
};

function getWaterEmoji(id: string): string {
  for (const key of Object.keys(WATER_EMOJIS)) {
    if (id.toLowerCase().includes(key)) return WATER_EMOJIS[key];
  }
  return '💧';
}

const PIE_COLORS = ['#1abc9c', '#3498db', '#f1c40f', '#e74c3c', '#9b59b6', '#e67e22', '#16a085', '#2980b9', '#f39c12', '#c0392b'];
const LINE_COLORS = ['#1abc9c', '#f1c40f'];

export default function ReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<WeeklyReport>('/report/weekly')
      .then((data) => setReport(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!report) return null;
    const waterList = Object.values(report.waterAreaStats);
    const totalCatches = waterList.reduce((sum, w) => sum + w.totalCatches, 0);
    const totalWeight = waterList.reduce((sum, w) => sum + w.totalWeight, 0);
    const mostActive = waterList.length > 0
      ? waterList.reduce((a, b) => (a.totalCatches > b.totalCatches ? a : b))
      : null;
    const topFisherman = report.topFishermen?.[0] || null;
    return { totalCatches, totalWeight, mostActive, topFisherman };
  }, [report]);

  const pieOption = useMemo(() => {
    if (!report) return {};
    const seriesData: Array<{ name: string; value: number; areaName: string }> = [];
    Object.values(report.waterAreaStats).forEach((area) => {
      Object.entries(area.fishDistribution).forEach(([fishId, count]) => {
        seriesData.push({
          name: `${area.waterAreaName} - ${fishId}`,
          value: count,
          areaName: area.waterAreaName,
        });
      });
    });
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.data.name}<br/>数量: ${p.data.value}`,
        backgroundColor: 'rgba(10, 37, 64, 0.95)',
        borderColor: 'rgba(26, 188, 156, 0.5)',
        textStyle: { color: '#fff' },
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 20,
        bottom: 20,
        textStyle: { color: '#94a3b8' },
      },
      color: PIE_COLORS,
      series: [
        {
          name: '鱼种分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: 'rgba(10, 37, 64, 0.8)',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
              color: '#fff',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(26, 188, 156, 0.5)',
            },
          },
          labelLine: {
            show: false,
          },
          data: seriesData,
        },
      ],
    };
  }, [report]);

  const lineOption = useMemo(() => {
    if (!report || report.efficiencyTrend.length === 0) return {};
    const dates = report.efficiencyTrend.map((d) => d.date);
    const avgWeights = report.efficiencyTrend.map((d) => Number(d.avgWeight.toFixed(2)));
    const totalCatches = report.efficiencyTrend.map((d) => d.totalCatches);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 37, 64, 0.95)',
        borderColor: 'rgba(26, 188, 156, 0.5)',
        textStyle: { color: '#fff' },
      },
      legend: {
        data: ['日均单重 (kg)', '日钓获条数'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#94a3b8' },
      },
      yAxis: [
        {
          type: 'value',
          name: '单重 (kg)',
          nameTextStyle: { color: '#94a3b8' },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        },
        {
          type: 'value',
          name: '条数',
          nameTextStyle: { color: '#94a3b8' },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: '#94a3b8' },
          splitLine: { show: false },
        },
      ],
      color: LINE_COLORS,
      series: [
        {
          name: '日均单重 (kg)',
          type: 'line',
          smooth: true,
          data: avgWeights,
          yAxisIndex: 0,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3 },
          itemStyle: { color: LINE_COLORS[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(26, 188, 156, 0.4)' },
                { offset: 1, color: 'rgba(26, 188, 156, 0)' },
              ],
            },
          },
        },
        {
          name: '日钓获条数',
          type: 'line',
          smooth: true,
          data: totalCatches,
          yAxisIndex: 1,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3 },
          itemStyle: { color: LINE_COLORS[1] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(241, 196, 15, 0.3)' },
                { offset: 1, color: 'rgba(241, 196, 15, 0)' },
              ],
            },
          },
        },
      ],
    };
  }, [report]);

  const barOption = useMemo(() => {
    if (!report) return {};
    const entries = Object.entries(report.cookingConsumption);
    if (entries.length === 0) return {};
    const names = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 37, 64, 0.95)',
        borderColor: 'rgba(26, 188, 156, 0.5)',
        textStyle: { color: '#fff' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#94a3b8', rotate: names.length > 5 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barWidth: '50%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#1abc9c' },
                { offset: 1, color: '#0d6b58' },
              ],
            },
          },
        },
      ],
    };
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📄</div>
          <div className="text-xl text-gray-400">加载周报中...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl text-gray-400">暂无周报数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">📊</span>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">
              第 {report.year} 年 第 {report.weekNumber} 周 周报
            </h1>
            <p className="text-gray-400 text-sm">
              {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <a
          href="/api/report/weekly/pdf"
          download={`weekly-report-${report.year}-w${report.weekNumber}.pdf`}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-display font-bold text-lg bg-gradient-to-r from-accent to-info text-primary hover:shadow-lg hover:shadow-accent/30 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <span className="text-2xl">📥</span>
          下载周报 PDF
        </a>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 rounded-2xl p-5 transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🎣</span>
              <span className="text-sm text-gray-300">本周总钓获</span>
            </div>
            <div className="text-4xl font-display font-bold text-accent tabular-nums transition-all duration-500">
              {stats.totalCatches.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400 mt-1">条</div>
          </div>
          <div className="bg-gradient-to-br from-info/20 to-info/5 border border-info/30 rounded-2xl p-5 transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">⚖️</span>
              <span className="text-sm text-gray-300">总重量</span>
            </div>
            <div className="text-4xl font-display font-bold text-info tabular-nums transition-all duration-500">
              {stats.totalWeight.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400 mt-1">kg</div>
          </div>
          <div className="bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 rounded-2xl p-5 transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🔥</span>
              <span className="text-sm text-gray-300">最活跃水域</span>
            </div>
            <div className="text-2xl font-display font-bold text-gold truncate">
              {stats.mostActive ? (
                <span className="flex items-center gap-2">
                  <span>{getWaterEmoji(stats.mostActive.waterAreaId)}</span>
                  <span>{stats.mostActive.waterAreaName}</span>
                </span>
              ) : (
                '-'
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {stats.mostActive ? `${stats.mostActive.totalCatches} 条 / ${stats.mostActive.totalWeight.toFixed(2)} kg` : '-'}
            </div>
          </div>
          <div className="bg-gradient-to-br from-danger/20 to-danger/5 border border-danger/30 rounded-2xl p-5 transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🏆</span>
              <span className="text-sm text-gray-300">本周 Top 钓手</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🧑‍🎣</span>
              <div className="min-w-0">
                <div className="text-2xl font-display font-bold text-danger truncate">
                  {stats.topFisherman?.playerName || '-'}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {stats.topFisherman ? `${stats.topFisherman.totalWeight.toFixed(2)} kg` : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🥧</span>
            <h2 className="text-xl font-display font-bold text-white">鱼种分布图</h2>
            <span className="text-sm text-gray-400">（按水域分组）</span>
          </div>
          <div style={{ height: 360 }}>
            <ReactECharts
              option={pieOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📈</span>
            <h2 className="text-xl font-display font-bold text-white">效率趋势图</h2>
            <span className="text-sm text-gray-400">（最近 7 天）</span>
          </div>
          <div style={{ height: 360 }}>
            <ReactECharts
              option={lineOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🍳</span>
            <h2 className="text-xl font-display font-bold text-white">烹饪消耗统计</h2>
          </div>
          {Object.keys(report.cookingConsumption).length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              本周暂无烹饪消耗数据
            </div>
          ) : (
            <div style={{ height: 300 }}>
              <ReactECharts
                option={barOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🏅</span>
            <h2 className="text-xl font-display font-bold text-white">钓手排行</h2>
          </div>
          {report.topFishermen?.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              暂无排行数据
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {report.topFishermen?.map((fisherman, idx) => (
                <div
                  key={fisherman.playerId}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/5 ${
                    idx === 0
                      ? 'bg-gradient-to-r from-yellow-500/20 to-transparent'
                      : idx === 1
                        ? 'bg-gradient-to-r from-gray-400/20 to-transparent'
                        : idx === 2
                          ? 'bg-gradient-to-r from-orange-600/20 to-transparent'
                          : ''
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold ${
                      idx === 0
                        ? 'bg-yellow-500/30 text-yellow-400'
                        : idx === 1
                          ? 'bg-gray-400/30 text-gray-300'
                          : idx === 2
                            ? 'bg-orange-600/30 text-orange-400'
                            : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </div>
                  <span className="text-2xl">🧑‍🎣</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{fisherman.playerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-display font-bold text-accent tabular-nums transition-all duration-500">
                      {fisherman.totalWeight.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">kg</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
