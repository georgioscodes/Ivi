import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { PlanItemResponse } from '@/api/types';
import { ItemRow, type ItemActions } from './ItemRow';
import './plan.css';

interface SortableItemsProps {
  items: PlanItemResponse[];
  actions?: ItemActions;
  /** Receives the meal's complete item list in its new order, which is what the API wants. */
  onReorder?: (orderedItemIds: number[]) => void;
}

/**
 * The items in one meal, reorderable.
 *
 * Two paths, both first-class rather than one being a fallback:
 *
 * - **Drag**, for a pointer or a touch screen. A tablet is an explicitly supported way of
 *   working and HTML5 drag-and-drop does not function on touch at all, which is most of why
 *   dnd-kit is here rather than the platform's own API.
 * - **Move up and move down buttons**, always visible. dnd-kit's keyboard mode works — space to
 *   lift, arrows to move, space to drop — but nothing on screen says so. Two buttons need no
 *   explaining, work with a switch or a screen reader, and are the obvious thing to reach for
 *   with three items in a narrow column.
 *
 * Dragging is confined to the vertical axis and to this meal, because the API reorders *within*
 * a meal and has no concept of moving an item to another one. A drag that looks like it will
 * cross columns and then silently does not is worse than one that never suggests it.
 */
export function SortableItems({ items, actions, onReorder }: SortableItemsProps) {
  const sensors = useSensors(
    // A small distance before a drag begins, so tapping the quantity field or a button inside
    // the row is not read as the start of one.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortable = onReorder !== undefined && items.length > 1;

  if (!sortable) {
    return (
      <ul className="meal__items">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} actions={actions} />
        ))}
      </ul>
    );
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) {
      return;
    }
    const ids = items.map((item) => item.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved as number);
    onReorder?.(ids);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    move(
      items.findIndex((item) => item.id === active.id),
      items.findIndex((item) => item.id === over.id),
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="meal__items">
          {items.map((item, index) => (
            <SortableItemRow
              key={item.id}
              item={item}
              actions={actions}
              position={index}
              total={items.length}
              onMove={move}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItemRow({
  item,
  actions,
  position,
  total,
  onMove,
}: {
  item: PlanItemResponse;
  actions?: ItemActions;
  position: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <ItemRow
      ref={setNodeRef}
      item={item}
      actions={actions}
      dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      reorder={{
        position,
        total,
        onMoveUp: () => onMove(position, position - 1),
        onMoveDown: () => onMove(position, position + 1),
        handleProps: { ...attributes, ...listeners },
      }}
    />
  );
}
