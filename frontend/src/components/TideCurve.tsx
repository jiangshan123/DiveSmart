import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useState, useRef, useEffect } from 'react';

interface TideValue {
  time: string;
  value: number;
}

interface ProcessedTideData {
  time: string;
  value: number;
  rawTime: number;
}

interface TideCurveProps {
  data: any;
}

interface CursorData {
  time: string;
  value: number;
  pixelX: number;
  pixelY: number;
}

export function TideCurve({ data }: TideCurveProps) {
  const [cursorData, setCursorData] = useState<CursorData | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  if (!data) {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No tide data available</p>;
  }

  // Extract tide values
  let tideValues: TideValue[] = [];
  if (data.values && Array.isArray(data.values)) {
    tideValues = data.values;
  } else if (Array.isArray(data)) {
    tideValues = data;
  } else {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Unsupported tide data format</p>;
  }

  if (tideValues.length === 0) {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No tide data available</p>;
  }

  // Filter data - 48 hours
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const filteredData = tideValues.filter((item: TideValue) => {
    const itemTime = new Date(item.time);
    return itemTime >= startTime && itemTime <= endTime;
  });

  const processedData: ProcessedTideData[] = filteredData.map((item: TideValue) => {
    const dateObj = new Date(item.time);
    return {
      time: dateObj.toLocaleTimeString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      value: parseFloat(item.value.toString()),
      rawTime: dateObj.getTime(),
    };
  });

  if (processedData.length === 0) {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No data available in 48-hour window</p>;
  }

  const values = processedData.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1;

  const nowTime = Date.now();
  let closestIndex = 0;
  let closestDiff = Math.abs(processedData[0].rawTime - nowTime);
  for (let i = 1; i < processedData.length; i++) {
    const diff = Math.abs(processedData[i].rawTime - nowTime);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  const interpolateTideValue = (targetTime: number): number | null => {
    if (targetTime < processedData[0].rawTime || targetTime > processedData[processedData.length - 1].rawTime) {
      return null;
    }

    for (let i = 0; i < processedData.length - 1; i++) {
      const current = processedData[i];
      const next = processedData[i + 1];

      if (current.rawTime <= targetTime && targetTime <= next.rawTime) {
        const ratio = (targetTime - current.rawTime) / (next.rawTime - current.rawTime);
        return current.value + (next.value - current.value) * ratio;
      }
    }
    return null;
  };

  // Initialize with current time tide data on load
  useEffect(() => {
    if (processedData.length === 0) return;
    
    const nowTime = Date.now();
    const value = interpolateTideValue(nowTime) || 0;
    const now = new Date();
    
    setCursorData({
      time: now.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: value,
      pixelX: 0,
      pixelY: 0,
    });
  }, [processedData.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current) return;

    const rect = chartWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = rect.width;
    const chartHeight = rect.height;
    const leftMargin = 50;
    const rightMargin = 30;
    const topMargin = 20;
    const bottomMargin = 100;

    const dataWidth = chartWidth - leftMargin - rightMargin;

    if (x < leftMargin || x > chartWidth - rightMargin || y < topMargin || y > chartHeight - bottomMargin) {
      setCursorData(null);
      return;
    }

    const percentage = (x - leftMargin) / dataWidth;
    const firstTime = processedData[0].rawTime;
    const lastTime = processedData[processedData.length - 1].rawTime;
    const targetTime = firstTime + (lastTime - firstTime) * percentage;

    const interpolatedValue = interpolateTideValue(targetTime);
    if (interpolatedValue === null) {
      setCursorData(null);
      return;
    }

    const dateObj = new Date(targetTime);
    
    const formattedTime = dateObj.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    setCursorData({
      time: formattedTime,
      value: interpolatedValue,
      pixelX: x,
      pixelY: y,
    });
  };

  const handleMouseLeave = () => {
    // Restore to current time when mouse leaves
    const nowTime = Date.now();
    const value = interpolateTideValue(nowTime) || 0;
    const now = new Date();
    
    setCursorData({
      time: now.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: value,
      pixelX: 0,
      pixelY: 0,
    });
  };

  const scrollToNow = () => {
    if (!chartWrapperRef.current) return;
    
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const leftMargin = 50;
    const rightMargin = 30;
    const chartWidth = rect.width;
    const dataWidth = chartWidth - leftMargin - rightMargin;
    
    const firstTime = processedData[0].rawTime;
    const lastTime = processedData[processedData.length - 1].rawTime;
    const percentage = (nowTime - firstTime) / (lastTime - firstTime);
    const pixelX = leftMargin + percentage * dataWidth;
    
    const value = interpolateTideValue(nowTime) || 0;
    
    setCursorData({
      time: now.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: value,
      pixelX: pixelX,
      pixelY: 50,
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 100,
          backgroundColor: 'white',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          minWidth: '220px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={scrollToNow}
            title="Back to current time"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1.5px solid #1890ff',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#1890ff',
              transition: 'all 0.2s',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = '#1890ff';
              target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'white';
              target.style.color = '#1890ff';
            }}
          >
            🕐
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1890ff' }}>
              {cursorData ? cursorData.time : now.toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        <div style={{ paddingLeft: '40px' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#999', fontWeight: '500' }}>Tide Height</p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#ff7a45' }}>
            {cursorData && cursorData.value !== null && cursorData.value !== undefined 
              ? cursorData.value.toFixed(2) 
              : '0.00'} <span style={{ fontSize: '11px', color: '#999' }}>m</span>
          </p>
        </div>
      </div>

      <div
        ref={chartWrapperRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'relative', width: '100%' }}
      >
        {cursorData && (
          <>
            <div
              style={{
                position: 'absolute',
                left: `${cursorData.pixelX}px`,
                top: '20px',
                height: '350px',
                width: '2px',
                backgroundColor: '#1890ff',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={processedData} margin={{ top: 20, right: 30, left: 50, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={true} />

            <XAxis
              dataKey="time"
              angle={-45}
              textAnchor="end"
              height={60}
              style={{ fontSize: '10px' }}
              tick={{ fill: '#999' }}
            />

            <YAxis
              domain={[Math.max(0, minValue - padding), maxValue + padding]}
              label={{ value: 'Tide Height (m)', angle: -90, position: 'insideLeft', offset: 10 }}
              style={{ fontSize: '11px' }}
              tick={{ fill: '#666' }}
            />

            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />

            <ReferenceLine
              x={processedData[closestIndex].time}
              stroke="#52c41a"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: 'Now', position: 'top', fill: '#52c41a', fontSize: 11, offset: 10 }}
            />

            <Line
              type="natural"
              dataKey="value"
              stroke="#1890ff"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="Tide Data"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '60px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px 0' }}>
          Range: -24h to +24h | High:{' '}
          <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '12px' }}>{maxValue.toFixed(3)}m</span> | Low:{' '}
          <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '12px' }}>{minValue.toFixed(3)}m</span>
        </p>
        <p style={{ margin: 0 }}>Move mouse over chart to track tide heights</p>
      </div>
    </div>
  );
}

