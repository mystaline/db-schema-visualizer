<script setup lang="ts">
import { computed } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'

const schemaStore = useSchemaStore()

const HEADER_HEIGHT = 40
const ROW_HEIGHT = 28
const TABLE_WIDTH = 200

const tableCoordsMap = computed(() => {
  const map = new Map<string, { x: number, y: number, columns: { id: string, name: string }[] }>()
  schemaStore.tables.forEach(t => {
    map.set(t.id, { x: t.x, y: t.y, columns: t.columns })
  })
  return map
})

const relations = computed(() => {
  const coords = tableCoordsMap.value
  const active = schemaStore.activeDrag

  return schemaStore.foreignKeys.map(fk => {
    const source = active?.id === fk.sourceTableId ? active : coords.get(fk.sourceTableId)
    const target = active?.id === fk.targetTableId ? active : coords.get(fk.targetTableId)

    if (!source || !target) return null
    if (isNaN(source.x) || isNaN(source.y) || isNaN(target.x) || isNaN(target.y)) return null

    const sourceTable = schemaStore.tables.find(t => t.id === fk.sourceTableId)
    const targetTable = schemaStore.tables.find(t => t.id === fk.targetTableId)

    if (!sourceTable || !targetTable) return null

    const sourceColIndex = sourceTable.columns.findIndex(c => c.id === fk.sourceColumnId)
    const targetColIndex = targetTable.columns.findIndex(c => c.id === fk.targetColumnId)

    if (sourceColIndex === -1 || targetColIndex === -1) return null

    const sourceCol = sourceTable.columns[sourceColIndex]
    const targetCol = targetTable.columns[targetColIndex]

    const sourceIsLeft = source.x + TABLE_WIDTH < target.x
    const sourceIsRight = source.x > target.x + TABLE_WIDTH

    let x1, x2
    if (sourceIsLeft) {
      x1 = source.x + TABLE_WIDTH
      x2 = target.x
    } else if (sourceIsRight) {
      x1 = source.x
      x2 = target.x + TABLE_WIDTH
    } else {
      x1 = source.x + TABLE_WIDTH
      x2 = target.x + TABLE_WIDTH
    }

    const y1 = source.y + HEADER_HEIGHT + (sourceColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
    const y2 = target.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)

    const dx = Math.abs(x2 - x1)
    const cp1x = x1 + (sourceIsLeft ? dx * 0.5 : -dx * 0.5)
    const cp2x = x2 + (sourceIsLeft ? -dx * 0.5 : dx * 0.5)

    return {
      id: fk.id,
      path: `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`,
      isSelected: schemaStore.selectedTableId === fk.sourceTableId || schemaStore.selectedTableId === fk.targetTableId,
      ariaLabel: `FK: ${sourceTable.name}.${sourceCol.name} → ${targetTable.name}.${targetCol.name} (ON DELETE ${fk.onDelete})`,
    }
  }).filter(Boolean)
})
</script>

<template>
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
    aria-label="Foreign key relationships"
    role="img"
  >
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          fill="currentColor"
        />
      </marker>
    </defs>

    <g
      v-for="rel in relations"
      :key="rel?.id"
    >
      <!-- Outer glow line when selected -->
      <!-- stroke: primary-400 (#009eff) at 15% opacity — hardcoded because SVG attributes
           cannot reference Tailwind utility classes or CSS custom properties -->
      <path
        v-if="rel?.isSelected"
        :d="rel.path"
        fill="none"
        stroke="rgba(0, 158, 255, 0.15)"
        stroke-width="8"
        aria-hidden="true"
      />

      <!-- Main relation line -->
      <path
        :d="rel?.path"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        :class="[
          rel?.isSelected ? 'text-primary-500 stroke-dash-animated' : 'text-secondary-500'
        ]"
        marker-end="url(#arrowhead)"
        role="img"
        :aria-label="rel?.ariaLabel"
      >
        <title>{{ rel?.ariaLabel }}</title>
      </path>
    </g>
  </svg>
</template>

<style scoped>
.stroke-dash-animated {
  stroke-dasharray: 4;
  animation: dash 20s linear infinite;
}

@keyframes dash {
  from {
    stroke-dashoffset: 200;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
