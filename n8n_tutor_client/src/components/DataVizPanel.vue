<template>
  <div class="w-1/2 flex flex-col bg-white border-l border-gray-100" style="height: 92vh;">
    <!-- View Mode Slider -->
    <div class="border-b border-gray-100 p-4 bg-gray-50" style="height: 11vh;">
      <div class="flex items-center justify-center">
        <div class="relative bg-white rounded-xl p-1 shadow-sm border border-gray-200">
          <div class="absolute top-1 bottom-1 bg-blue-600 rounded-lg transition-all duration-300 ease-in-out" :style="sliderStyle"></div>
          <div class="relative flex">
            <button @click="$emit('update:viewMode', 'map')" :class="['flex items-center justify-center px-6 py-2 text-sm font-medium rounded-lg transition-colors duration-200 relative z-10', viewMode === 'map' ? 'text-white' : 'text-gray-600 hover:text-gray-900']">
              <MapPin class="w-4 h-4 mr-2" /> {{ t('map.title') }}
            </button>
            <button @click="$emit('update:viewMode', 'table')" :class="['flex items-center justify-center px-6 py-2 text-sm font-medium rounded-lg transition-colors duration-200 relative z-10', viewMode === 'table' ? 'text-white' : 'text-gray-600 hover:text-gray-900']">
              <Table class="w-4 h-4 mr-2" /> {{ t('table.title') }}
            </button>
            <button @click="$emit('update:viewMode', 'pdf')" :class="['flex items-center justify-center px-6 py-2 text-sm font-medium rounded-lg transition-colors duration-200 relative z-10', viewMode === 'pdf' ? 'text-white' : 'text-gray-600 hover:text-gray-900']">
              <FileText class="w-4 h-4 mr-2" /> {{ t('pdf.title') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Area (Conditionally renders the specific view component) -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <MapView 
        v-show="viewMode === 'map'"
        :map-container-ref-fn="mapContainerRefFn"
        @reset-map-view="$emit('resetMapView')"
      />
      <TableView
        v-if="viewMode === 'table'"
        :query-results="queryResults"
      />
      <PdfView
        v-else-if="viewMode === 'pdf'"
        :current-pdf-url="currentPdfUrl"
        :current-pdf-name="currentPdfName"
        :total-pdf-pages="totalPdfPages"
        v-model:current-pdf-page="currentPdfPageProxy"
        @pdf-loaded="$emit('pdfLoaded', $event)"
        @download-pdf="$emit('downloadCurrentPdf')"
      />
    </div>

    <!-- SQL Query Section (Remains in the parent) -->
    <div class="border-t border-gray-100" style="height: 32vh;">
      <div class="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <Database class="w-4 h-4 text-gray-500" />
            <h3 class="text-sm font-medium text-gray-900">{{ t('query.title') }}</h3>
          </div>
          <div class="flex items-center space-x-2">
            <button @click="$emit('copyQuery')" :disabled="!generatedQuery.trim()" class="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-all disabled:opacity-50" :title="t('query.copy')">
              <Copy class="w-3 h-3 mr-1" />{{ t('query.copy') }}
            </button>
            <button @click="$emit('executeQuery')" :disabled="!generatedQuery.trim()" class="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-all disabled:opacity-50">
              <Play class="w-3 h-3 mr-1" />{{ t('query.execute') }}
            </button>
          </div>
        </div>
      </div>
      <div class="p-4">
        <div v-if="!generatedQuery.trim()" class="text-center py-8 text-gray-500">
          <Database class="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p class="text-sm">{{ t('query.placeholder') }}</p>
        </div>
        <div v-else>
          <div
            ref="editorContainer"
            class="border border-gray-200 rounded-lg text-sm font-mono min-h-[10rem] max-h-[11rem] overflow-auto"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { MapPin, Table, FileText, Database, Copy, Play } from 'lucide-vue-next';
import { useI18n } from '../composables/useI18n';
import MapView from './views/MapView.vue';
import TableView from './views/TableView.vue';
import PdfView from './views/PdfView.vue';

// CodeMirror Imports
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';

const props = defineProps({
  viewMode: String,
  generatedQuery: String,
  queryResults: Array,
  mapContainerRefFn: Function,
  currentPdfUrl: String,
  currentPdfName: String,
  currentPdfPage: Number,
  totalPdfPages: Number,
});

const emit = defineEmits([
  'update:viewMode',
  'update:generatedQuery',
  'update:currentPdfPage',
  'executeQuery',
  'copyQuery',
  'resetMapView',
  'pdfLoaded',
  'downloadCurrentPdf'
]);

const { t } = useI18n();

// Create a proxy for v-model on a child component prop
const currentPdfPageProxy = computed({
  get: () => props.currentPdfPage,
  set: (value) => emit('update:currentPdfPage', value)
});

const sliderStyle = computed(() => {
  const position = props.viewMode === 'map' ? '4px' : props.viewMode === 'table' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 2px)';
  return { left: position, width: 'calc(33.333% - 2px)' };
});

// --- CodeMirror Implementation (remains in the parent) ---
const editorContainer = ref(null);
let editorView = null;

const sqlHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff', fontWeight: 'bold' },
  { tag: tags.string, color: '#008000' },
  { tag: tags.number, color: '#ff0000' },
  { tag: tags.comment, color: '#808080', fontStyle: 'italic' },
]);

const customSetup = [
  lineNumbers(), highlightActiveLine(), history(), indentOnInput(), bracketMatching(),
  highlightSelectionMatches(), syntaxHighlighting(sqlHighlightStyle, { fallback: true }), keymap.of(defaultKeymap),
  EditorView.theme({
    '&': { fontSize: '13px', fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace' },
    '.cm-editor': { height: '100%', minHeight: '10rem' },
    '.cm-focused': { outline: 'none' },
    '.cm-content': { padding: '12px', minHeight: '10rem' },
    '.cm-scroller': { fontFamily: 'inherit' }
  })
];

const createEditor = () => {
  if (!editorContainer.value) return;
  const state = EditorState.create({
    doc: props.generatedQuery || '',
    extensions: [
      ...customSetup, sql({ dialect: PostgreSQL }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:generatedQuery', update.state.doc.toString());
      })
    ]
  });
  editorView = new EditorView({ state, parent: editorContainer.value });
};

watch(() => props.generatedQuery, (newQuery) => {
  if (editorView && newQuery !== editorView.state.doc.toString()) {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: newQuery || '' }
    });
  }
});

// Add method to handle query copying from chat
const handleQueryFromChat = (query) => {
  // First update the query value
  emit('update:generatedQuery', query);
};

// Update the existing watch to prevent conflicts
watch(() => props.generatedQuery, (newQuery, oldQuery) => {
  const isQueryPresent = newQuery && newQuery.trim();
  if (isQueryPresent && !editorView) {
    nextTick(createEditor);
  } else if (!isQueryPresent && editorView) {
    editorView.destroy();
    editorView = null;
  }
}, { immediate: true }); // Set immediate to true to handle initial query

onMounted(() => {
  // The immediate watcher now handles editor creation on mount
});

onUnmounted(() => {
  if (editorView) editorView.destroy();
});

// Expose the method to parent component
defineExpose({
  handleQueryFromChat
});
</script>