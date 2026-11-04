import { useEffect, useState } from 'react'

import { hogqlQuery } from '~/queries/query'
import { hogql } from '~/queries/utils'

interface Kpi {
    label: string
    value: string
    delta: number
    series: number[]
    color: string
}

const DAYS = 28

function Sparkline({ series, color }: { series: number[]; color: string }): JSX.Element {
    const w = 160
    const h = 40
    const max = Math.max(...series, 1)
    const min = Math.min(...series, 0)
    const range = max - min || 1
    const points = series.map((v, i) => [
        (i / Math.max(series.length - 1, 1)) * w,
        h - 2 - ((v - min) / range) * (h - 4),
    ])
    const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `0,${h} ${line} ${w},${h}`
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10">
            <polygon points={area} fill={color} opacity={0.12} />
            <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </svg>
    )
}

function halfDelta(series: number[]): number {
    const mid = Math.floor(series.length / 2)
    const a = series.slice(0, mid).reduce((s, v) => s + v, 0)
    const b = series.slice(mid).reduce((s, v) => s + v, 0)
    return a ? ((b - a) / a) * 100 : 0
}

const fmt = (n: number): string => n.toLocaleString('en-US')

async function loadKpis(): Promise<Kpi[]> {
    const res = await hogqlQuery(hogql`
        WITH (SELECT toStartOfDay(max(timestamp)) FROM events) AS end_ts
        SELECT
            toStartOfDay(timestamp) AS day,
            countIf(event = '$pageview') AS pageviews,
            uniq(person_id) AS users,
            countIf(event = 'signed_up') AS signups
        FROM events
        WHERE timestamp > end_ts - toIntervalDay(${DAYS}) AND timestamp < end_ts
        GROUP BY day
        ORDER BY day`)
    const rows = (res.results ?? []) as [string, number, number, number][]
    const pageviews = rows.map((r) => Number(r[1]))
    const users = rows.map((r) => Number(r[2]))
    const signups = rows.map((r) => Number(r[3]))
    const conversion = rows.map((r) => (Number(r[2]) ? (Number(r[3]) / Number(r[2])) * 100 : 0))
    const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0)
    const totalConv = sum(users) ? (sum(signups) / sum(users)) * 100 : 0
    return [
        {
            label: 'Pageviews',
            value: fmt(sum(pageviews)),
            delta: halfDelta(pageviews),
            series: pageviews,
            color: '#1d4aff',
        },
        { label: 'Unique users', value: fmt(sum(users)), delta: halfDelta(users), series: users, color: '#9b51e0' },
        { label: 'Signups', value: fmt(sum(signups)), delta: halfDelta(signups), series: signups, color: '#29a37a' },
        {
            label: 'Conversion',
            value: `${totalConv.toFixed(1)}%`,
            delta: halfDelta(conversion),
            series: conversion,
            color: '#f54e00',
        },
    ]
}

export function DashboardKpiHeader(): JSX.Element {
    const [kpis, setKpis] = useState<Kpi[] | null>(null)

    useEffect(() => {
        loadKpis()
            .then(setKpis)
            .catch(() => setKpis([]))
    }, [])

    const placeholders = ['Pageviews', 'Unique users', 'Signups', 'Conversion']

    return (
        <div className="grid grid-cols-4 gap-4 mb-4">
            {(kpis && kpis.length ? kpis : placeholders.map((label) => ({ label }) as Partial<Kpi>)).map((kpi) => (
                <div
                    key={kpi.label}
                    className="rounded-lg border bg-surface-primary p-4 flex flex-col gap-1 shadow-sm"
                    style={{ borderTop: `4px solid ${kpi.color ?? 'var(--border)'}` }}
                >
                    <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{kpi.label}</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold leading-tight">{kpi.value ?? '…'}</span>
                        {kpi.delta !== undefined && (
                            <span
                                className={`text-sm font-semibold ${kpi.delta >= 0 ? 'text-success' : 'text-danger'}`}
                            >
                                {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    {kpi.series ? <Sparkline series={kpi.series} color={kpi.color!} /> : <div className="h-10" />}
                    <div className="text-xs text-tertiary">Last {DAYS} days</div>
                </div>
            ))}
        </div>
    )
}
