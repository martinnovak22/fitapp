import { useSharedValue } from 'react-native-reanimated';

export function useSortableList() {
    const activeIndex = useSharedValue(-1);
    const translationY = useSharedValue(0);

    const getTargetIndex = (currentIndex: number, itemCount: number, itemHeight: number) => {
        'worklet';
        if (activeIndex.value === -1) return currentIndex;

        const delta = Math.round(translationY.value / itemHeight);
        const targetIndex = Math.max(0, Math.min(itemCount - 1, activeIndex.value + delta));

        return targetIndex;
    };

    const getItemOffset = (index: number, itemCount: number, itemHeight: number) => {
        'worklet';
        if (activeIndex.value === -1 || activeIndex.value === index) return 0;

        const targetIndex = getTargetIndex(activeIndex.value, itemCount, itemHeight);

        if (index > activeIndex.value && index <= targetIndex) {
            return -itemHeight;
        }
        if (index < activeIndex.value && index >= targetIndex) {
            return itemHeight;
        }
        return 0;
    };

    return {
        activeIndex,
        translationY,
        getTargetIndex,
        getItemOffset,
    };
}
