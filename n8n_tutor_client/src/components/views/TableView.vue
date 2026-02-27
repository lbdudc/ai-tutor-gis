<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="p-4 bg-gray-50 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <Table class="w-4 h-4 text-gray-500" />
          <h3 class="text-sm font-medium text-gray-900">Query Results</h3>
        </div>
        <div v-if="queryResults.length > 0" class="text-xs text-gray-600">
          <span class="font-medium">{{ queryResults.length }} rows</span>
        </div>
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <div v-if="queryResults.length === 0" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <Table class="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p class="text-sm">No query results to display</p>
          <p class="text-xs text-gray-400 mt-1">Execute a query to see results here</p>
        </div>
      </div>
      
      <div v-else class="h-full overflow-auto" style="max-height:500px;">
        <table class="w-full table-auto">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th v-for="column in tableColumns" :key="column" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(row, index) in queryResults" :key="index" class="hover:bg-gray-50">
              <td v-for="column in tableColumns" :key="column" class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" :title="formatCellValue(row[column])">
                {{ formatCellValue(row[column]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Table } from 'lucide-vue-next';

const props = defineProps({
  queryResults: {
    type: Array,
    required: true,
  }
});

const tableColumns = computed(() => {
  if (!props.queryResults || props.queryResults.length === 0) return [];
  return Object.keys(props.queryResults[0]);
});

const formatCellValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > 150 ? `${str.substring(0, 150)}...` : str;
  }
  const str = String(value);
  return str.length > 150 ? `${str.substring(0, 150)}...` : str;
};
</script>