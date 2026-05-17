-- ============================================================================
-- More ingredients: 10 tomato varieties, ~28 vegetables not yet in the
-- catalogue, ~35 BBQ-oriented meats. ON CONFLICT keeps the migration
-- idempotent against the existing seed.
-- ============================================================================

insert into public.ingredient (ingredient_name, ingredient_default_unit, ingredient_type)
values
  -- Variétés de tomate (toujours « Tomate (…) »)
  ('Tomate (cœur de bœuf)',     'piece', 'legumes'),
  ('Tomate (ananas)',           'piece', 'legumes'),
  ('Tomate (noire de Crimée)',  'piece', 'legumes'),
  ('Tomate (green zebra)',      'piece', 'legumes'),
  ('Tomate (San Marzano)',      'piece', 'legumes'),
  ('Tomate (Roma)',             'piece', 'legumes'),
  ('Tomate (cornue des Andes)', 'piece', 'legumes'),
  ('Tomate (Marmande)',         'piece', 'legumes'),
  ('Tomate (Rose de Berne)',    'piece', 'legumes'),
  ('Tomate (Marbrée)',          'piece', 'legumes'),

  -- Légumes supplémentaires (pas encore dans le catalogue)
  ('Cornichon',                 'piece', 'legumes'),
  ('Aubergine blanche',         'piece', 'legumes'),
  ('Aubergine japonaise',       'piece', 'legumes'),
  ('Aubergine ronde',           'piece', 'legumes'),
  ('Salsifis',                  'g',     'legumes'),
  ('Crosne',                    'g',     'legumes'),
  ('Chayote',                   'piece', 'legumes'),
  ('Manioc',                    'g',     'legumes'),
  ('Igname',                    'g',     'legumes'),
  ('Taro',                      'g',     'legumes'),
  ('Daïkon',                    'piece', 'legumes'),
  ('Pousse de bambou',          'g',     'legumes'),
  ('Racine de lotus',           'g',     'legumes'),
  ('Tétragone',                 'g',     'legumes'),
  ('Brocoli rabe',              'g',     'legumes'),
  ('Brocolini',                 'g',     'legumes'),
  ('Salicorne',                 'g',     'legumes'),
  ('Fleur de courgette',        'piece', 'legumes'),
  ('Pomme de terre nouvelle',   'g',     'legumes'),
  ('Pomme de terre grenaille',  'g',     'legumes'),
  ('Patate douce violette',     'g',     'legumes'),
  ('Cresson alénois',           'botte', 'legumes'),
  ('Chou-rave',                 'piece', 'legumes'),
  ('Concombre noa',             'piece', 'legumes'),
  ('Poivron pointu',            'piece', 'legumes'),
  ('Choy sum',                  'botte', 'legumes'),
  ('Mizuna',                    'botte', 'legumes'),
  ('Tatsoi',                    'botte', 'legumes'),

  -- Saucisses & charcuteries grillables
  ('Saucisse de porc',          'piece', 'viande'),
  ('Saucisse de porc aux herbes','piece','viande'),
  ('Saucisse de Toulouse',      'piece', 'viande'),
  ('Saucisse de Morteau',       'piece', 'viande'),
  ('Saucisse de Francfort',     'piece', 'viande'),
  ('Chipolata',                 'piece', 'viande'),
  ('Merguez',                   'piece', 'viande'),
  ('Chorizo',                   'piece', 'viande'),
  ('Boudin noir',               'piece', 'viande'),
  ('Saucisse fumée',            'piece', 'viande'),

  -- Porc
  ('Côte de porc',              'piece', 'viande'),
  ('Travers de porc',           'g',     'viande'),
  ('Échine de porc',            'g',     'viande'),
  ('Filet mignon de porc',      'piece', 'viande'),
  ('Poitrine de porc',          'g',     'viande'),
  ('Lardons',                   'g',     'viande'),
  ('Rouelle de porc',           'piece', 'viande'),
  ('Pied de porc',              'piece', 'viande'),

  -- Bœuf
  ('Côte de bœuf',              'piece', 'viande'),
  ('Entrecôte',                 'piece', 'viande'),
  ('Faux-filet',                'piece', 'viande'),
  ('Bavette',                   'piece', 'viande'),
  ('Onglet',                    'piece', 'viande'),
  ('Hampe',                     'piece', 'viande'),
  ('Steak haché',               'piece', 'viande'),
  ('Brochette de bœuf',         'piece', 'viande'),

  -- Volaille
  ('Cuisse de poulet',          'piece', 'viande'),
  ('Pilon de poulet',           'piece', 'viande'),
  ('Aile de poulet',            'piece', 'viande'),
  ('Blanc de poulet',           'piece', 'viande'),
  ('Magret de canard',          'piece', 'viande'),
  ('Aiguillette de canard',     'piece', 'viande'),

  -- Agneau
  ('Côte d''agneau',            'piece', 'viande'),
  ('Gigot d''agneau',           'piece', 'viande'),
  ('Brochette d''agneau',       'piece', 'viande')
on conflict (lower(ingredient_name)) do nothing;
