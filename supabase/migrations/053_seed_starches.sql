-- ============================================================================
-- Seed the three new starch-related types added in migration 052:
--   49 céréales, 28 légumineuses, 27 féculents = 104 new ingredients.
-- ON CONFLICT keeps the migration idempotent against the existing catalogue.
-- ============================================================================

insert into public.ingredient (ingredient_name, ingredient_default_unit, ingredient_type)
values
  -- ----------- CÉRÉALES (49) -----------
  -- Riz
  ('Riz blanc',                 'g', 'cereales'),
  ('Riz long',                  'g', 'cereales'),
  ('Riz basmati',               'g', 'cereales'),
  ('Riz thaï',                  'g', 'cereales'),
  ('Riz jasmin',                'g', 'cereales'),
  ('Riz rouge',                 'g', 'cereales'),
  ('Riz noir',                  'g', 'cereales'),
  ('Riz complet',               'g', 'cereales'),
  ('Riz arborio',               'g', 'cereales'),
  ('Riz carnaroli',             'g', 'cereales'),
  ('Riz gluant',                'g', 'cereales'),
  ('Riz sauvage',               'g', 'cereales'),
  ('Riz à sushi',               'g', 'cereales'),

  -- Blé
  ('Farine de blé T45',         'g', 'cereales'),
  ('Farine de blé T55',         'g', 'cereales'),
  ('Farine de blé T65',         'g', 'cereales'),
  ('Farine de blé T80',         'g', 'cereales'),
  ('Farine de blé T110',        'g', 'cereales'),
  ('Farine de blé T150',        'g', 'cereales'),
  ('Farine de blé complète',    'g', 'cereales'),
  ('Boulgour',                  'g', 'cereales'),
  ('Semoule de blé fine',       'g', 'cereales'),
  ('Semoule de blé moyenne',    'g', 'cereales'),
  ('Couscous',                  'g', 'cereales'),
  ('Blé précuit',               'g', 'cereales'),
  ('Épeautre',                  'g', 'cereales'),
  ('Petit épeautre',            'g', 'cereales'),

  -- Avoine
  ('Flocons d''avoine',         'g', 'cereales'),
  ('Son d''avoine',             'g', 'cereales'),
  ('Farine d''avoine',          'g', 'cereales'),

  -- Maïs
  ('Polenta',                   'g', 'cereales'),
  ('Semoule de maïs',           'g', 'cereales'),
  ('Maïzena',                   'g', 'cereales'),
  ('Farine de maïs',            'g', 'cereales'),

  -- Sarrasin / pseudo-céréales
  ('Sarrasin',                  'g', 'cereales'),
  ('Farine de sarrasin',        'g', 'cereales'),
  ('Kasha',                     'g', 'cereales'),
  ('Quinoa blanc',              'g', 'cereales'),
  ('Quinoa rouge',              'g', 'cereales'),
  ('Quinoa noir',               'g', 'cereales'),
  ('Amarante',                  'g', 'cereales'),

  -- Orge & autres
  ('Orge perlé',                'g', 'cereales'),
  ('Orge mondé',                'g', 'cereales'),
  ('Millet',                    'g', 'cereales'),
  ('Sorgho',                    'g', 'cereales'),
  ('Teff',                      'g', 'cereales'),
  ('Fonio',                     'g', 'cereales'),
  ('Seigle en grain',           'g', 'cereales'),
  ('Farine de seigle',          'g', 'cereales'),

  -- ----------- LÉGUMINEUSES (28) -----------
  -- Lentilles
  ('Lentille verte',            'g', 'legumineuses'),
  ('Lentille corail',           'g', 'legumineuses'),
  ('Lentille blonde',           'g', 'legumineuses'),
  ('Lentille noire Beluga',     'g', 'legumineuses'),
  ('Lentille du Puy',           'g', 'legumineuses'),
  ('Lentille brune',            'g', 'legumineuses'),

  -- Pois chiche
  ('Pois chiche',               'g', 'legumineuses'),
  ('Farine de pois chiche',     'g', 'legumineuses'),

  -- Haricots secs
  ('Haricot blanc',             'g', 'legumineuses'),
  ('Haricot rouge',             'g', 'legumineuses'),
  ('Haricot noir',              'g', 'legumineuses'),
  ('Haricot pinto',             'g', 'legumineuses'),
  ('Haricot azuki',             'g', 'legumineuses'),
  ('Haricot mungo',             'g', 'legumineuses'),
  ('Haricot de Lima',           'g', 'legumineuses'),
  ('Haricot borlotti',          'g', 'legumineuses'),
  ('Haricot coco',              'g', 'legumineuses'),
  ('Haricot lingot',            'g', 'legumineuses'),
  ('Flageolet',                 'g', 'legumineuses'),

  -- Pois secs / fèves sèches
  ('Pois cassé',                'g', 'legumineuses'),
  ('Pois entier sec',           'g', 'legumineuses'),
  ('Fève sèche',                'g', 'legumineuses'),
  ('Cornille',                  'g', 'legumineuses'),
  ('Pois d''Angole',            'g', 'legumineuses'),

  -- Soja & dérivés
  ('Soja jaune',                'g', 'legumineuses'),
  ('Lupin',                     'g', 'legumineuses'),
  ('Tofu',                      'g', 'legumineuses'),
  ('Tempeh',                    'g', 'legumineuses'),

  -- ----------- FÉCULENTS (27) -----------
  -- Pâtes sèches longues
  ('Spaghetti',                 'g',     'feculents'),
  ('Tagliatelles',              'g',     'feculents'),
  ('Linguine',                  'g',     'feculents'),
  ('Vermicelles',               'g',     'feculents'),

  -- Pâtes sèches courtes
  ('Penne',                     'g',     'feculents'),
  ('Rigatoni',                  'g',     'feculents'),
  ('Fusilli',                   'g',     'feculents'),
  ('Farfalle',                  'g',     'feculents'),
  ('Coquillettes',              'g',     'feculents'),
  ('Macaroni',                  'g',     'feculents'),

  -- Pâtes plates / plats préparés
  ('Lasagnes',                  'g',     'feculents'),
  ('Cannelloni',                'piece', 'feculents'),
  ('Tortellini',                'g',     'feculents'),
  ('Ravioli',                   'g',     'feculents'),
  ('Gnocchi',                   'g',     'feculents'),

  -- Pâtes fraîches & spécialités
  ('Pâtes fraîches',            'g',     'feculents'),
  ('Spätzle',                   'g',     'feculents'),

  -- Nouilles asiatiques
  ('Nouilles chinoises',        'g',     'feculents'),
  ('Nouilles soba',             'g',     'feculents'),
  ('Nouilles udon',             'g',     'feculents'),
  ('Nouilles ramen',            'g',     'feculents'),
  ('Vermicelle de riz',         'g',     'feculents'),
  ('Galette de riz',            'piece', 'feculents'),

  -- Autres féculents
  ('Châtaigne',                 'g',     'feculents'),
  ('Marron',                    'g',     'feculents'),
  ('Tapioca',                   'g',     'feculents'),
  ('Perles du Japon',           'g',     'feculents')
on conflict (lower(ingredient_name)) do nothing;
