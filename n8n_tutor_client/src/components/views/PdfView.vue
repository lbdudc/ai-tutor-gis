<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header (No changes here) -->
    <div class="p-4 bg-gray-50 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <FileText class="w-4 h-4 text-gray-500" />
          <h3 class="text-sm font-medium text-gray-900">{{ t('pdf.viewer') }}</h3>
          <span v-if="currentPdfName" class="text-xs text-gray-500">{{ currentPdfName }}</span>
        </div>
        <div v-if="currentPdfUrl" class="flex items-center space-x-2">
          <!-- Zoom Controls -->
          <div class="flex items-center space-x-1 bg-white rounded-md border border-gray-200 p-1">
            <button 
              @click="zoomOut" 
              :disabled="zoomLevel <= 0.5"
              class="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              :title="t('pdf.zoomOut')"
            >
              <ZoomOut class="w-3 h-3" />
            </button>
            <span class="text-xs text-gray-600 px-2 min-w-[3rem] text-center">{{ Math.round(zoomLevel * 100) }}%</span>
            <button 
              @click="zoomIn" 
              :disabled="zoomLevel >= 3"
              class="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              :title="t('pdf.zoomIn')"
            >
              <ZoomIn class="w-3 h-3" />
            </button>
            <button 
              @click="resetZoom"
              class="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-all ml-1"
              :title="t('pdf.fitToWidth')"
            >
              <RotateCcw class="w-3 h-3" />
            </button>
          </div>
          <button 
            @click="$emit('downloadPdf')" 
            class="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-all"
          >
            <Download class="w-3 h-3 mr-1" />{{ t('pdf.download') }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Content -->
    <div ref="pdfContainerRef" class="flex-1 overflow-auto bg-gray-100">
      <div v-if="!currentPdfUrl" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <FileText class="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p class="text-sm">{{ t('pdf.noDocumentLoaded') }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ t('pdf.loadInstructions') }}</p>
        </div>
      </div>
      
      <div v-else class="flex justify-center h-full overflow-auto py-5" style="width: 48w;">
        <div class="relative" style="width: 46vw;">
          <div
              class="transform transition-transform"
              :style="{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center'
              }"
          >
              <VuePdfEmbed
                  v-if="containerWidth > 0"
                  :source="currentPdfUrl" 
                  :page="currentPdfPage"
                  :width="containerWidth"
                  @loaded="$emit('pdfLoaded', $event)" 
              />
          </div>
          <!-- Page Controls (No changes here) -->
          <div class="sticky bottom-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-200/50 flex items-center space-x-3 w-max mx-auto">
            <button 
              @click="$emit('update:currentPdfPage', currentPdfPage - 1)" 
              :disabled="currentPdfPage <= 1" 
              class="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-all"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <span class="text-xs text-gray-600">{{ currentPdfPage }} / {{ totalPdfPages }}</span>
            <button 
              @click="$emit('update:currentPdfPage', currentPdfPage + 1)" 
              :disabled="currentPdfPage >= totalPdfPages" 
              class="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-all"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { FileText, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next';
import VuePdfEmbed from 'vue-pdf-embed';
import { useI18n } from '../../composables/useI18n';

defineProps({
  currentPdfUrl: String,
  currentPdfName: String,
  currentPdfPage: Number,
  totalPdfPages: Number,
});

defineEmits(['update:currentPdfPage', 'pdfLoaded', 'downloadPdf']);

const { t } = useI18n();

// (CHANGED) New logic for width-based zooming
const pdfContainerRef = ref(null);
const containerWidth = ref(0);
const zoomLevel = ref(0.5); // 1.0 = 100% of container width

// This computed property calculates the PDF width based on the container size and zoom level
const pdfWidth = computed(() => containerWidth.value * zoomLevel.value);
const containerHeight = ref(0);

useResizeObserver(pdfContainerRef, (entries) => {
  const entry = entries[0];
  containerWidth.value = entry.contentRect.width;
  containerHeight.value = entry.contentRect.height;
});

const zoomIn = () => {
  if (zoomLevel.value < 3) {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.25);
  }
};

const zoomOut = () => {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.25);
  }
};

// Reset zoom now means "fit to width"
const resetZoom = () => {
  zoomLevel.value = 1;
};
</script>

<style scoped>
:deep(.vue-pdf-embed) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* The margin: 0 auto is now handled by the flex container */
}

/* This style is no longer strictly necessary with the new layout, but can be kept */
:deep(.vue-pdf-embed > div) {
  display: inline-block;
}
</style>