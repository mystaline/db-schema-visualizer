<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const searchQuery = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const selectedIndex = ref(0);

interface DataTypeGroup {
  group: string;
  types: string[];
}

const dataTypes: DataTypeGroup[] = [
  {
    group: "Numeric",
    types: [
      "smallint",
      "integer",
      "bigint",
      "smallserial",
      "serial",
      "bigserial",
      "numeric",
      "decimal",
      "real",
      "double precision",
    ],
  },
  { 
    group: "Text", 
    types: ["varchar", "text", "char", "citext", "name", "uuid"] 
  },
  {
    group: "Date/Time",
    types: ["timestamp", "timestamptz", "date", "time", "timetz", "interval"],
  },
  {
    group: "JSON/NoSQL",
    types: ["jsonb", "json", "xml", "hstore"],
  },
  {
    group: "Network",
    types: ["inet", "cidr", "macaddr", "macaddr8"],
  },
  {
    group: "Boolean",
    types: ["boolean"],
  },
  {
    group: "Arrays",
    types: [
      "text[]",
      "integer[]",
      "bigint[]",
      "numeric[]",
      "boolean[]",
      "uuid[]",
      "jsonb[]",
    ],
  },
  {
    group: "Geometric",
    types: ["point", "line", "lseg", "box", "path", "polygon", "circle"],
  },
  {
    group: "Binary",
    types: ["bytea", "bit", "varbit"],
  },
  {
    group: "Full Text Search",
    types: ["tsvector", "tsquery"],
  },
];

const allTypes = dataTypes.flatMap((g: DataTypeGroup) => g.types);

const filteredGroups = computed<DataTypeGroup[]>(() => {
  if (!searchQuery.value) return dataTypes;
  
  const query = searchQuery.value.toLowerCase();
  return dataTypes.map(group => ({
    ...group,
    types: group.types.filter(t => t.toLowerCase().includes(query))
  })).filter(group => group.types.length > 0);
});

const flatFilteredTypes = computed<string[]>(() => {
  return filteredGroups.value.flatMap((g: DataTypeGroup) => g.types);
});

const dropdownPos = ref({ top: 0, left: 0 });

const toggleDropdown = async () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    const rect = containerRef.value?.getBoundingClientRect();
    if (rect) {
      dropdownPos.value = { 
        top: rect.bottom + window.scrollY + 4, 
        left: rect.left + window.scrollX 
      };
    }
    searchQuery.value = "";
    selectedIndex.value = 0;
    await nextTick();
    searchInput.value?.focus();
  }
};

const selectType = (type: string) => {
  emit("update:modelValue", type);
  isOpen.value = false;
};

const selectCustom = () => {
  if (searchQuery.value) {
    emit("update:modelValue", searchQuery.value.toLowerCase());
  }
  isOpen.value = false;
};

const onKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) return;

  if (e.key === "Escape") {
    isOpen.value = false;
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % flatFilteredTypes.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + flatFilteredTypes.value.length) % flatFilteredTypes.value.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (flatFilteredTypes.value.length > 0 && selectedIndex.value >= 0) {
      selectType(flatFilteredTypes.value[selectedIndex.value]);
    } else if (searchQuery.value) {
      selectCustom();
    }
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div 
    ref="containerRef"
    class="relative w-full h-7"
  >
    <!-- Trigger Button -->
    <button
      type="button"
      :disabled="disabled"
      class="w-full h-full flex items-center justify-between px-2 bg-secondary-950 border border-secondary-800 rounded text-[10px] font-mono text-secondary-300 hover:border-secondary-600 transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-default"
      @click="toggleDropdown"
    >
      <span class="truncate uppercase">{{ modelValue || 'select type' }}</span>
      <svg class="w-3 h-3 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed z-99999 w-64 mt-1 bg-secondary-900 border border-secondary-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100"
        :style="{
          left: `${dropdownPos.left}px`,
          top: `${dropdownPos.top}px`,
          maxHeight: '300px'
        }"
      >
        <!-- Search Input -->
        <div class="sticky top-0 p-2 bg-secondary-900 border-b border-secondary-800">
          <div class="relative">
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search or type custom..."
              class="w-full bg-secondary-950 border border-secondary-800 rounded px-2 py-1.5 text-xs text-secondary-100 focus:outline-none focus:border-primary-500 placeholder:text-secondary-600"
              @keydown="onKeydown"
            />
            <div 
              v-if="searchQuery && !flatFilteredTypes.includes(searchQuery.toLowerCase())"
              class="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-primary-500/20 text-[9px] text-primary-400 font-bold uppercase tracking-tight"
            >
              Enter to use custom
            </div>
          </div>
        </div>

        <!-- Types List -->
        <div class="overflow-y-auto max-h-[220px] custom-scrollbar">
          <template v-for="group in filteredGroups" :key="group.group">
            <div class="px-3 py-1 bg-secondary-800/30">
              <span class="text-[9px] font-bold text-secondary-500 uppercase tracking-widest">{{ group.group }}</span>
            </div>
            <button
              v-for="type in group.types"
              :key="type"
              type="button"
              class="w-full text-left px-4 py-1.5 text-xs hover:bg-primary-500/10 hover:text-primary-400 transition-colors flex items-center justify-between group"
              :class="[
                type === modelValue ? 'text-primary-400 bg-primary-500/5' : 'text-secondary-300',
                flatFilteredTypes[selectedIndex] === type ? 'bg-secondary-800 ring-inset ring-1 ring-primary-500/30' : ''
              ]"
              @click="selectType(type)"
            >
              <span>{{ type }}</span>
              <svg 
                v-if="type === modelValue" 
                class="w-3.5 h-3.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </template>

          <!-- No Results -->
          <div 
            v-if="filteredGroups.length === 0" 
            class="p-4 text-center"
          >
            <p class="text-xs text-secondary-500 italic mb-2">No predefined type matched</p>
            <button
              v-if="searchQuery"
              type="button"
              class="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold rounded-md transition-all"
              @click="selectCustom"
            >
              Use "{{ searchQuery.toLowerCase() }}"
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
