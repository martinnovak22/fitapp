import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

type PlateMotifProps = {
    // The accent the plates are tinted with.
    color: string
    // The card's own colour, used for the cut-outs (grip holes, centre hole).
    surface: string
    // Multiplies the tint opacities; dark surfaces need a little more.
    intensity?: number
    size?: number
    style?: StyleProp<ViewStyle>
}

const GRIP_ANGLES = [30, 90, 150, 210, 270, 330]

// Two weight plates seen face on, built from tonal accent layers: the plate
// body, a raised lip, six grip holes cut through, and the hub around the bar
// hole. Purely decorative, so it is hidden from screen readers; the parent
// places it in a corner and lets the card's radius crop it.
export function PlateMotif({ color, surface, intensity = 1, size = 210, style }: PlateMotifProps) {
    const o = (value: number) => Math.min(1, value * intensity)
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 240 240"
            style={style}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
        >
            {/* Small plate, behind and up-left */}
            <G>
                <Circle cx={56} cy={58} r={50} fill={color} fillOpacity={o(0.07)} />
                <Circle cx={56} cy={58} r={41} fill="none" stroke={color} strokeOpacity={o(0.16)} strokeWidth={2} />
                <Circle cx={56} cy={58} r={13} fill={color} fillOpacity={o(0.16)} />
                <Circle cx={56} cy={58} r={5} fill={surface} />
            </G>
            {/* Large plate */}
            <G>
                <Circle cx={156} cy={100} r={88} fill={color} fillOpacity={o(0.1)} />
                <Circle cx={156} cy={100} r={76} fill="none" stroke={color} strokeOpacity={o(0.2)} strokeWidth={2} />
                <Circle cx={156} cy={100} r={66} fill={color} fillOpacity={o(0.04)} />
                {GRIP_ANGLES.map((angle) => {
                    const rad = (angle * Math.PI) / 180
                    const cx = 156 + Math.cos(rad) * 50
                    const cy = 100 + Math.sin(rad) * 50
                    return (
                        <G key={angle}>
                            <Circle cx={cx} cy={cy} r={9} fill={surface} />
                            <Circle
                                cx={cx}
                                cy={cy}
                                r={9}
                                fill="none"
                                stroke={color}
                                strokeOpacity={o(0.2)}
                                strokeWidth={1.5}
                            />
                        </G>
                    )
                })}
                <Circle cx={156} cy={100} r={26} fill={color} fillOpacity={o(0.2)} />
                <Circle cx={156} cy={100} r={10} fill={surface} />
            </G>
        </Svg>
    )
}
