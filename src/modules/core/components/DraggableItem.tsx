import React, { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    LinearTransition,
    runOnJS,
    SharedValue,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';


interface Props {
    children: ReactNode;
    index: number;
    itemCount?: number;
    itemHeight?: number;
    enabled?: boolean;
    onDrop: (index: number, translationY: number) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    style?: StyleProp<ViewStyle>;
    activeScale?: number;
    activeOpacity?: number;
    longPressDuration?: number;
    useLayoutAnimation?: boolean;
    activeIndex?: SharedValue<number>;
    translationY?: SharedValue<number>;
}

export function DraggableItem({
    children,
    index,
    itemCount,
    itemHeight,
    enabled = true,
    onDrop,
    onDragStart,
    onDragEnd,
    style,
    activeScale = 1.03,
    activeOpacity = 0.9,
    longPressDuration = 300,
    activeIndex,
    translationY,
}: Props) {
    const { theme, isDark } = useTheme();
    const isPressed = useSharedValue(false);


    const localActiveIndex = useSharedValue(-1);
    const localTranslationY = useSharedValue(0);
    const dragTranslationY = useSharedValue(0);

    const activeIndexVal = activeIndex ?? localActiveIndex;
    const translationYVal = translationY ?? localTranslationY;

    const isActive = useDerivedValue(() => {
        return isPressed.value || (activeIndexVal.value === index && activeIndexVal.value !== -1);
    });

    const panGesture = Gesture.Pan()

        .activateAfterLongPress(longPressDuration)
        .onStart(() => {
            isPressed.value = true;
            activeIndexVal.value = index;
            if (onDragStart) runOnJS(onDragStart)();
        })
        .onUpdate((event) => {
            dragTranslationY.value = event.translationY;
            translationYVal.value = event.translationY;
        })
        .onEnd((event) => {
            const finalY = event.translationY;
            isPressed.value = false;

            if (itemHeight) {
                const delta = Math.round(finalY / itemHeight);
                dragTranslationY.value = withSpring(delta * itemHeight, { damping: 50, stiffness: 600 });
            } else {
                dragTranslationY.value = withSpring(0);
            }

            runOnJS(onDrop)(index, finalY);
        })
        .onFinalize(() => {
            dragTranslationY.value = withSpring(0);
            if (onDragEnd) runOnJS(onDragEnd)();
        })
        .enabled(enabled);

    const animatedStyle = useAnimatedStyle(() => {
        let offset = 0;
        const active = isActive.value;

        if (active) {
            offset = dragTranslationY.value;
        } else if (activeIndexVal.value !== -1 && itemCount !== undefined && itemHeight !== undefined) {
            const delta = Math.round(translationYVal.value / itemHeight);
            const targetIndex = Math.max(0, Math.min(itemCount - 1, activeIndexVal.value + delta));

            if (index > activeIndexVal.value && index <= targetIndex) {
                offset = -itemHeight;
            } else if (index < activeIndexVal.value && index >= targetIndex) {
                offset = itemHeight;
            }
        }

        const translation = withSpring(offset, { damping: 80, stiffness: 400, mass: 0.8 });

        const activeBg = isDark ? '#2A2A2A' : '#F5F5F5';
        const activeBorder = isDark ? '#4A4A4A' : '#CCCCCC';

        const targetBg = active ? activeBg : theme.card;
        const targetBorder = active ? activeBorder : theme.border;

        return {
            transform: [
                { translateY: translation },
                { scale: withSpring(isPressed.value ? activeScale : 1, { damping: 20, stiffness: 300 }) }
            ],
            zIndex: active ? 1000 : 1,
            backgroundColor: withSpring(targetBg, { damping: 30, stiffness: 300 }),
            borderColor: targetBorder,
            shadowOpacity: withSpring(isPressed.value ? 0.3 : 0, { damping: 30, stiffness: 300 }),
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 5 },
            elevation: isPressed.value ? 2 : 0,
            opacity: withSpring(isPressed.value ? activeOpacity : 1, { damping: 30, stiffness: 300 }),
        };
    }, [theme, isDark, activeScale, activeOpacity, index, itemCount, itemHeight, isPressed, activeIndexVal, translationYVal]);


    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View
                style={[style, animatedStyle]}
                layout={LinearTransition.springify().damping(30).stiffness(300).mass(0.8)}
            >
                {children}
            </Animated.View>
        </GestureDetector>
    );
}
