<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'

const props = withDefaults(defineProps<{ flat?: boolean }>(), { flat: false })

const schemaStore = useSchemaStore()
const tableName = ref('')
const touched = ref(false)

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const identifierError = computed(() => {
  const name = tableName.value.trim()
  if (!name) return null
  if (!IDENTIFIER_RE.test(name)) return 'Only letters, digits, underscores. Cannot start with a digit.'
  if (schemaStore.tables.some(t => t.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists.`
  return null
})

const handleAddTable = () => {
  touched.value = true
  const name = tableName.value.trim()
  if (!name || identifierError.value) return
  schemaStore.addTable(name)
  tableName.value = ''
  touched.value = false
}
</script>

<template>
  <div :class="flat ? '' : 'px-4 py-6 border-t border-secondary-600 bg-secondary-950'">
    <form
      class="space-y-3"
      @submit.prevent="handleAddTable"
    >
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold uppercase tracking-widest text-secondary-300 ml-1">Table Name</label>
        <div class="relative group">
          <input
            :value="tableName"
            type="text"
            placeholder="e.g. user_profiles"
            class="w-full bg-secondary-950 border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all placeholder:text-secondary-500 focus:ring-4"
            :class="touched && identifierError
              ? 'border-danger-500/70 focus:border-danger-500 focus:ring-danger-500/10 text-danger-500'
              : 'border-secondary-800 focus:border-primary-500 focus:ring-primary-500/10'"
            @input="(e) => {
              let v = (e.target as HTMLInputElement).value.replace(/[^a-zA-Z0-9_]/g, '')
              if (v && /^\d/.test(v)) v = '_' + v
              tableName = v;
              (e.target as HTMLInputElement).value = v
            }"
            @keydown.enter.prevent="handleAddTable"
            @blur="touched = true"
          >
          <div class="absolute right-3 top-2.5 text-secondary-500 text-[10px] font-mono group-focus-within:text-primary-500 transition-colors">
            /
          </div>
        </div>
        <p
          v-if="touched && identifierError"
          class="text-[10px] text-danger-500 ml-1"
        >
          {{ identifierError }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="!tableName.trim() || !!identifierError"
        class="w-full flex items-center justify-center gap-2 p-3 border border-primary-500/30 bg-primary-500/5 hover:bg-primary-500 hover:border-primary-500 active:scale-95 rounded-xl text-primary-400 hover:text-white text-sm font-bold transition-all group disabled:opacity-30 disabled:pointer-events-none shadow-sm"
      >
        <svg
          class="w-5 h-5 group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        New Entity
      </button>
    </form>
  </div>
</template>
