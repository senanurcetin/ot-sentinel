import * as React from 'react'

type IconProps = React.SVGProps<SVGSVGElement>

const MockIcon = React.forwardRef<SVGSVGElement, IconProps>(function MockIcon(props, ref) {
  return <svg ref={ref} data-testid="lucide-icon" {...props} />
})

export type LucideIcon = typeof MockIcon

export const createLucideIcon = () => MockIcon

export const Activity = MockIcon
export const AlertCircle = MockIcon
export const AlertTriangle = MockIcon
export const ArrowLeft = MockIcon
export const ArrowRight = MockIcon
export const BarChart2 = MockIcon
export const Check = MockIcon
export const CheckCircle = MockIcon
export const ChevronDown = MockIcon
export const ChevronLeft = MockIcon
export const ChevronRight = MockIcon
export const ChevronUp = MockIcon
export const Circle = MockIcon
export const Download = MockIcon
export const FileSearch = MockIcon
export const Gauge = MockIcon
export const Globe = MockIcon
export const List = MockIcon
export const ListChecks = MockIcon
export const PanelLeft = MockIcon
export const Router = MockIcon
export const Server = MockIcon
export const Shield = MockIcon
export const ShieldAlert = MockIcon
export const ShieldCheck = MockIcon
export const Thermometer = MockIcon
export const Waves = MockIcon
export const X = MockIcon
