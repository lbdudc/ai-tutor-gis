<template>
  <div class="flex-1 relative bg-gray-50 p-4">
    <div :ref="mapContainerRefFn" class="w-full h-full rounded-xl shadow-sm border border-gray-200 overflow-hidden"></div>
    <div class="absolute top-8 right-8 flex flex-col space-y-2" style="z-index: 1000;">
      <button 
        @click="$emit('resetMapView')" 
        class="p-2 bg-white/90 hover:bg-white backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/50 transition-all" 
        :title="t('map.resetViewTitle')"
      >
        <RotateCcw class="w-4 h-4 text-gray-600" />
      </button>
      <button 
        class="p-2 bg-white/90 hover:bg-white backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/50 transition-all" 
        :title="t('map.toggleLayersTitle')"
      >
        <Layers class="w-4 h-4 text-gray-600" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { RotateCcw, Layers } from 'lucide-vue-next';
import { useI18n } from '../../composables/useI18n';

defineProps({
  mapContainerRefFn: {
    type: Function,
    required: true,
  }
});

defineEmits(['resetMapView']);

const { t } = useI18n();
</script>