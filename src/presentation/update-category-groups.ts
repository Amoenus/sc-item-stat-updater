import type { UpdateCategory } from '../application/use-cases/prepare-update-categories';

interface UpdateCategoryGroupDescriptor {
  title: string;
  ids: string[];
}

export interface UpdateCategoryGroup {
  title: string;
  categories: UpdateCategory[];
}

const UPDATE_CATEGORY_GROUPS: UpdateCategoryGroupDescriptor[] = [
  {
    title: 'DC ship systems',
    ids: [
      'dc-coolers',
      'dc-powerplants',
      'dc-quantum-drives',
      'dc-jump-drives',
      'dc-qeds',
      'dc-radars',
      'dc-shields',
      'dc-self-destruct',
    ],
  },
  {
    title: 'DC weapons and ordnance',
    ids: [
      'dc-bombs',
      'dc-emps',
      'dc-missiles',
      'dc-missile-launchers',
      'dc-turrets',
      'dc-throwables',
      'dc-weapon-attachments',
      'dc-weapon-defensive',
      'dc-weapon-guns',
      'dc-weapon-personal',
    ],
  },
  {
    title: 'DC mining and utility',
    ids: ['dc-mining-lasers', 'dc-mining-modifiers', 'dc-salvage-modifiers', 'dc-tractor-beams'],
  },
  {
    title: 'Missions and economy',
    ids: [
      'mission-commodities',
      'mission-datacore-descriptions',
      'mission-datacore-titles',
      'mission-mining-elements',
      'mission-mining-locations',
    ],
  },
];

export function groupUpdateCategories(categories: UpdateCategory[]): UpdateCategoryGroup[] {
  const categoriesById = new Map(categories.map((category) => [category.source?.category, category]));
  const assigned = new Set<UpdateCategory>();
  const groups = UPDATE_CATEGORY_GROUPS.flatMap((group) => {
    const groupCategories = group.ids.flatMap((id) => {
      const category = categoriesById.get(id);
      if (!category) return [];
      assigned.add(category);
      return [category];
    });

    return groupCategories.length > 0 ? [{ title: group.title, categories: groupCategories }] : [];
  });
  const remainingCategories = categories.filter((category) => !assigned.has(category));

  if (remainingCategories.length > 0) {
    groups.push({ title: 'Other updates', categories: remainingCategories });
  }

  return groups;
}
