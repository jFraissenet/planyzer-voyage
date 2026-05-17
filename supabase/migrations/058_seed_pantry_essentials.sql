-- ============================================================================
-- Pantry essentials needed to seed the first public recipes (migration 059):
-- crémerie (œuf, lait, beurre, parmesan, crème fraîche), viandes additionnelles
-- (bœuf haché, paleron, épaule de veau), citron, sel/poivre/épices courants,
-- huile d'olive, conserves tomates, vins de cuisson, sucre.
-- ============================================================================

insert into public.ingredient (ingredient_name, ingredient_default_unit, ingredient_type)
values
  -- Crémerie
  ('Œuf',                       'piece', 'cremerie'),
  ('Lait demi-écrémé',          'ml',    'cremerie'),
  ('Beurre doux',               'g',     'cremerie'),
  ('Crème fraîche',             'g',     'cremerie'),
  ('Parmesan',                  'g',     'cremerie'),

  -- Viande
  ('Bœuf haché',                'g',     'viande'),
  ('Paleron de bœuf',           'g',     'viande'),
  ('Épaule de veau',            'g',     'viande'),

  -- Fruits
  ('Citron',                    'piece', 'fruits'),

  -- Condiments & épices
  ('Sel',                       'g',     'condiments_epices'),
  ('Poivre noir',               'g',     'condiments_epices'),
  ('Piment d''Espelette',       'g',     'condiments_epices'),
  ('Herbes de Provence',        'g',     'condiments_epices'),
  ('Huile d''olive',            'ml',    'condiments_epices'),

  -- Épicerie salée
  ('Concentré de tomate',       'g',     'epicerie_salee'),
  ('Tomates concassées',        'g',     'epicerie_salee'),

  -- Boissons (vins de cuisson + spiritueux)
  ('Vin rouge',                 'ml',    'boissons'),
  ('Vin blanc',                 'ml',    'boissons'),
  ('Rhum',                      'ml',    'boissons'),

  -- Épicerie sucrée
  ('Sucre',                     'g',     'epicerie_sucree')
on conflict (lower(ingredient_name)) do nothing;
