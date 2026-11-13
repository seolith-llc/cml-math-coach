/**
 * CogAT-style Verbal Battery: analogies, sentence completion, classification (original items).
 * Grade 2 is picture-based and read aloud (like CogAT Level 8); Grade 3 uses words (like Level 9).
 */
import type { Topic } from '../../core/types';
import { SceneBuilder, rect, text } from '../../core/scene';
import { wrap } from '../../core/explain';
import { choicesFor, mc, retry } from './common';
import { svgBox } from './figures';

const W = 360, H = 220;

/* ======================= analogies ======================= */

/** [a, a-picture, b, b-picture, the relation said in words] */
type Pair = [string, string, string, string, string];

const RELATIONS: { name: string; picture: boolean; pairs: Pair[] }[] = [
  { name: 'eats', picture: true, pairs: [
    ['rabbit', '🐰', 'carrots', '🥕', 'A rabbit eats carrots.'], ['monkey', '🐒', 'bananas', '🍌', 'A monkey eats bananas.'], ['mouse', '🐭', 'cheese', '🧀', 'A mouse eats cheese.'],
    ['dog', '🐶', 'bones', '🦴', 'A dog chews bones.'], ['panda', '🐼', 'bamboo', '🎋', 'A panda eats bamboo.'], ['squirrel', '🐿️', 'nuts', '🌰', 'A squirrel eats nuts.'],
    ['bird', '🐦', 'worms', '🪱', 'A bird eats worms.'], ['cow', '🐄', 'grass', '🌿', 'A cow eats grass.']] },
  { name: 'lives', picture: true, pairs: [
    ['camel', '🐫', 'desert', '🏜️', 'A camel lives in the desert.'], ['penguin', '🐧', 'snow', '❄️', 'A penguin lives where there is ice and snow.'],
    ['fish', '🐠', 'ocean', '🌊', 'A fish lives in the ocean.'], ['monkey', '🐒', 'jungle', '🌴', 'A monkey lives in the jungle.'], ['squirrel', '🐿️', 'tree', '🌳', 'A squirrel lives in a tree.']] },
  { name: 'wear', picture: true, pairs: [
    ['hand', '✋', 'glove', '🧤', 'You wear a glove on your hand.'], ['foot', '🦶', 'shoe', '👟', 'You wear a shoe on your foot.'], ['eyes', '👀', 'glasses', '👓', 'You wear glasses on your eyes.'],
    ['legs', '🦵', 'pants', '👖', 'You wear pants on your legs.']] },
  { name: 'grows', picture: true, pairs: [
    ['egg', '🥚', 'chick', '🐣', 'An egg hatches into a chick.'], ['caterpillar', '🐛', 'butterfly', '🦋', 'A caterpillar grows into a butterfly.'],
    ['sprout', '🌱', 'tree', '🌳', 'A little sprout grows into a tree.'], ['baby', '👶', 'grown-up', '🧑', 'A baby grows into a grown-up.']] },
  { name: 'use', picture: true, pairs: [
    ['key', '🔑', 'lock', '🔒', 'A key opens a lock.'], ['pencil', '✏️', 'paper', '📄', 'You write on paper with a pencil.'], ['spoon', '🥄', 'soup', '🍲', 'You eat soup with a spoon.'],
    ['toothbrush', '🪥', 'teeth', '🦷', 'You clean your teeth with a toothbrush.']] },
  { name: 'opposite', picture: true, pairs: [
    ['fire', '🔥', 'ice', '🧊', 'Fire is hot and ice is cold: opposites.'], ['sun', '☀️', 'moon', '🌙', 'The sun is out in the day, the moon at night: opposites.'],
    ['up', '⬆️', 'down', '⬇️', 'Up is the opposite of down.'], ['left', '⬅️', 'right', '➡️', 'Left is the opposite of right.']] },
  { name: 'baby animal', picture: false, pairs: [
    ['dog', '', 'puppy', '', 'A baby dog is a puppy.'], ['cat', '', 'kitten', '', 'A baby cat is a kitten.'], ['cow', '', 'calf', '', 'A baby cow is a calf.'], ['sheep', '', 'lamb', '', 'A baby sheep is a lamb.'],
    ['horse', '', 'foal', '', 'A baby horse is a foal.'], ['duck', '', 'duckling', '', 'A baby duck is a duckling.'], ['bear', '', 'cub', '', 'A baby bear is a cub.'], ['frog', '', 'tadpole', '', 'A baby frog is a tadpole.']] },
  { name: 'opposite words', picture: false, pairs: [
    ['hot', '', 'cold', '', 'Hot is the opposite of cold.'], ['big', '', 'small', '', 'Big is the opposite of small.'], ['fast', '', 'slow', '', 'Fast is the opposite of slow.'], ['happy', '', 'sad', '', 'Happy is the opposite of sad.'],
    ['wet', '', 'dry', '', 'Wet is the opposite of dry.'], ['full', '', 'empty', '', 'Full is the opposite of empty.'], ['early', '', 'late', '', 'Early is the opposite of late.'], ['loud', '', 'quiet', '', 'Loud is the opposite of quiet.'],
    ['open', '', 'closed', '', 'Open is the opposite of closed.']] },
  { name: 'tool', picture: false, pairs: [
    ['knife', '', 'cut', '', 'You cut with a knife.'], ['broom', '', 'sweep', '', 'You sweep with a broom.'], ['shovel', '', 'dig', '', 'You dig with a shovel.'], ['needle', '', 'sew', '', 'You sew with a needle.'],
    ['pen', '', 'write', '', 'You write with a pen.'], ['oven', '', 'bake', '', 'You bake in an oven.']] },
  { name: 'workplace', picture: false, pairs: [
    ['teacher', '', 'school', '', 'A teacher works at a school.'], ['doctor', '', 'hospital', '', 'A doctor works at a hospital.'], ['chef', '', 'kitchen', '', 'A chef works in a kitchen.'],
    ['pilot', '', 'airplane', '', 'A pilot works on an airplane.'], ['farmer', '', 'farm', '', 'A farmer works on a farm.'], ['librarian', '', 'library', '', 'A librarian works at a library.']] },
  { name: 'makes', picture: true, pairs: [
    ['cow', '🐄', 'milk', '🥛', 'A cow gives us milk.'], ['bee', '🐝', 'honey', '🍯', 'A bee makes honey.'], ['hen', '🐔', 'egg', '🥚', 'A hen lays eggs.'],
    ['sheep', '🐑', 'wool', '🧶', 'A sheep gives us wool.'], ['spider', '🕷️', 'web', '🕸️', 'A spider spins a web.']] },
  { name: 'weather needs', picture: true, pairs: [
    ['rain', '🌧️', 'umbrella', '☂️', 'When it rains, you use an umbrella.'], ['snow', '❄️', 'mittens', '🧤', 'When it snows, you wear mittens.'],
    ['sun', '☀️', 'sunglasses', '🕶️', 'When it is sunny, you wear sunglasses.'], ['wind', '🌬️', 'kite', '🪁', 'When it is windy, you fly a kite.']] },
  { name: 'goes in', picture: true, pairs: [
    ['letter', '✉️', 'mailbox', '📫', 'A letter goes in a mailbox.'], ['car', '🚗', 'road', '🛣️', 'A car drives on a road.'],
    ['train', '🚂', 'tracks', '🛤️', 'A train runs on tracks.'], ['boat', '⛵', 'water', '🌊', 'A boat sails on water.']] },
  { name: 'feelings', picture: true, pairs: [
    ['gift', '🎁', 'happy', '😀', 'A gift makes you happy.'], ['scary ghost', '👻', 'scared', '😱', 'A scary ghost makes you scared.'], ['clown', '🤡', 'laughing', '😂', 'A funny clown makes you laugh.'],
    ['bedtime', '🛏️', 'sleepy', '😴', 'Bedtime makes you sleepy.']] },
  { name: 'animal home', picture: false, pairs: [
    ['bee', '', 'hive', '', 'A bee lives in a hive.'], ['bird', '', 'nest', '', 'A bird lives in a nest.'], ['bear', '', 'den', '', 'A bear lives in a den.'], ['rabbit', '', 'burrow', '', 'A rabbit lives in a burrow.'],
    ['horse', '', 'stable', '', 'A horse lives in a stable.'], ['pig', '', 'pen', '', 'A pig lives in a pen.']] },
  { name: 'animal sound', picture: false, pairs: [
    ['dog', '', 'bark', '', 'A dog barks.'], ['cat', '', 'meow', '', 'A cat meows.'], ['cow', '', 'moo', '', 'A cow moos.'], ['duck', '', 'quack', '', 'A duck quacks.'], ['lion', '', 'roar', '', 'A lion roars.'],
    ['snake', '', 'hiss', '', 'A snake hisses.'], ['owl', '', 'hoot', '', 'An owl hoots.']] },
  { name: 'animal group', picture: false, pairs: [
    ['cow', '', 'herd', '', 'Many cows make a herd.'], ['bird', '', 'flock', '', 'Many birds make a flock.'], ['wolf', '', 'pack', '', 'Many wolves make a pack.'], ['fish', '', 'school', '', 'Many fish swimming together make a school.'],
    ['bee', '', 'swarm', '', 'Many bees flying together make a swarm.']] },
  { name: 'part of', picture: false, pairs: [
    ['petal', '', 'flower', '', 'A petal is part of a flower.'], ['wheel', '', 'car', '', 'A wheel is part of a car.'], ['page', '', 'book', '', 'A page is part of a book.'], ['leaf', '', 'tree', '', 'A leaf is part of a tree.'],
    ['finger', '', 'hand', '', 'A finger is part of a hand.'], ['toe', '', 'foot', '', 'A toe is part of a foot.']] },
  { name: 'same meaning', picture: false, pairs: [
    ['big', '', 'large', '', 'Big means the same as large.'], ['small', '', 'tiny', '', 'Small means about the same as tiny.'], ['fast', '', 'quick', '', 'Fast means the same as quick.'],
    ['happy', '', 'glad', '', 'Happy means the same as glad.'], ['shout', '', 'yell', '', 'Shout means the same as yell.'], ['begin', '', 'start', '', 'Begin means the same as start.']] },
  { name: 'made of', picture: false, pairs: [
    ['window', '', 'glass', '', 'A window is made of glass.'], ['table', '', 'wood', '', 'A wooden table is made of wood.'], ['sweater', '', 'wool', '', 'A sweater is made of wool.'],
    ['coin', '', 'metal', '', 'A coin is made of metal.'], ['candle', '', 'wax', '', 'A candle is made of wax.']] }
];

const related = new Set(RELATIONS.flatMap((r) => r.pairs.map((p) => `${p[0]}>${p[2]}`)));

function analogyScene(ab: Pair, cd: Pair, pics: boolean) {
  const s = new SceneBuilder(W, H);
  const face = (p: Pair, side: 0 | 1) => (pics ? p[side === 0 ? 1 : 3] : p[side === 0 ? 0 : 2]);
  const size = pics ? 40 : 18;
  const row = (id: string, p: Pair, y: number, known: boolean) => {
    s.add(rect(`${id}a`, 40, y - 30, 110, 60, { fill: 'fill', stroke: 'line', rx: 10 }), text(`${id}at`, 95, y, face(p, 0), { size }));
    s.add(text(`${id}arrow`, 180, y, '→', { size: 24, fill: 'muted' }));
    s.add(rect(`${id}b`, 210, y - 30, 110, 60, { fill: 'fill', stroke: 'line', rx: 10, dash: !known }), text(`${id}bt`, 265, y, known ? face(p, 1) : '?', { size: known ? size : 26, fill: known ? 'ink' : 'muted', weight: 700 }));
  };
  row('r1', ab, 50, true);
  row('r2', cd, 140, false);
  s.step(pics ? 'The first two pictures go together. Find the picture that goes with the third one in the same way.' : 'The first two words go together. Find the word that goes with the third one in the same way.');
  s.set('r1a', { stroke: 'accent', sw: 3 }).set('r1b', { stroke: 'accent', sw: 3 });
  s.add(text('why1', W / 2, 98, ab[4], { size: 14, fill: 'accent', weight: 600 }));
  s.step(`How do they go together? ${ab[4]}`);
  s.set('r1a', { stroke: 'line', sw: 1.5 }).set('r1b', { stroke: 'line', sw: 1.5 }).set('r2a', { stroke: 's2', sw: 3 });
  s.step(`Now say the same thing about the ${cd[0]}.`);
  s.set('r2b', { stroke: 'good', sw: 3, dash: false }).set('r2bt', { text: face(cd, 1), fill: 'good', size, pulse: true });
  s.add(text('why2', W / 2, 190, cd[4], { size: 14, fill: 'good', weight: 600 }));
  s.step(cd[4], { reveal: true });
  return s.build();
}

export const verbalAnalogies: Topic = {
  id: 'cogat-analogies',
  title: 'Picture & word analogies',
  category: 'Verbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'Make up a sentence that tells how the first two go together, like "A rabbit eats carrots." Then use the same sentence for the third: "A monkey eats …"',
    tips: ['Say the sentence out loud.', 'If two answers fit, make your sentence more exact.', 'Read every choice before you pick.'],
    traps: ['Picking something that just goes with the third word in a different way.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const pics = grade === 2;
    const rel = rng.pick(RELATIONS.filter((r) => !pics || r.picture));
    const [ab, cd] = rng.sample(rel.pairs, 2);
    if (ab[2] === cd[2]) return null;
    const others = RELATIONS.filter((r) => r !== rel && (!pics || r.picture)).flatMap((r) => r.pairs);
    const wrong = [ab, ...rng.shuffle(rel.pairs.filter((p) => p !== ab && p !== cd)), ...rng.shuffle(others)]
      .filter((p) => !related.has(`${cd[0]}>${p[2]}`) && p[2] !== cd[0] && !(pics && p[3] === cd[3]));
    const m = mc(rng, cd, wrong, choicesFor(grade), (p) => (pics ? p[3] : p[2]), (p) => p[2], pics ? (p) => p[3] : undefined);
    if (!m) return null;
    const figure = pics
      ? svgBox(320, 80, `${ab[0]} goes with ${ab[2]}; ${cd[0]} goes with what`,
        `<rect x="6" y="8" width="64" height="64" rx="10" stroke-width="2"/><text x="38" y="54" text-anchor="middle" font-size="40" stroke="none" fill="currentColor">${ab[1]}</text>` +
        `<rect x="88" y="8" width="64" height="64" rx="10" stroke-width="2"/><text x="120" y="54" text-anchor="middle" font-size="40" stroke="none" fill="currentColor">${ab[3]}</text>` +
        `<line x1="160" y1="16" x2="160" y2="64" stroke-width="2"/>` +
        `<rect x="168" y="8" width="64" height="64" rx="10" stroke-width="2"/><text x="200" y="54" text-anchor="middle" font-size="40" stroke="none" fill="currentColor">${cd[1]}</text>` +
        `<rect x="250" y="8" width="64" height="64" rx="10" stroke-width="2" stroke-dasharray="5 5"/><text x="282" y="52" text-anchor="middle" font-size="28" font-weight="700" stroke="none" fill="currentColor">?</text>`)
      : undefined;
    return {
      text: pics ? 'The **first two** pictures go together. Which picture goes with the **third one** in the **same way**?' : `**${ab[0]} → ${ab[2]}**  :  **${cd[0]} → ?**`,
      speech: pics ? `${ab[0]} goes with ${ab[2]}. ${cd[0]} goes with what?` : `${ab[0]} goes with ${ab[2]}. ${cd[0]} goes with what?`,
      figure,
      answer: m.answer,
      hints: [`How do ${ab[0]} and ${ab[2]} go together? Say it as a sentence.`, `${ab[4]} Now say it about the ${cd[0]}.`],
      steps: [ab[4], cd[4]],
      misconceptions: m.miss(ab, `That is the answer for the first pair. Use the same rule on the ${cd[0]}.`),
      scene: analogyScene(ab, cd, pics)
    };
  })
};

/* ======================= sentence completion ======================= */

/** Grade 2: a spoken question with picture answers. [answer, picture], wrong [word, picture][], why. */
const PICTURE_SENTENCES: { q: string; a: [string, string]; d: [string, string][]; why: string }[] = [
  { q: 'Which one do you use to cut paper?', a: ['scissors', '✂️'], d: [['spoon', '🥄'], ['ruler', '📏'], ['cup', '🥤']], why: 'Scissors cut paper.' },
  { q: 'Which one keeps you dry in the rain?', a: ['umbrella', '☂️'], d: [['sunglasses', '🕶️'], ['ball', '⚽'], ['book', '📖']], why: 'An umbrella keeps the rain off you.' },
  { q: 'Which one tells you the time?', a: ['clock', '⏰'], d: [['book', '📖'], ['lamp', '💡'], ['cake', '🎂']], why: 'A clock shows the time.' },
  { q: 'Which animal gives us milk?', a: ['cow', '🐄'], d: [['dog', '🐶'], ['fish', '🐟'], ['frog', '🐸']], why: 'Milk comes from cows.' },
  { q: 'Which one do you wear on your feet?', a: ['shoes', '👟'], d: [['hat', '🎩'], ['gloves', '🧤'], ['scarf', '🧣']], why: 'Shoes go on your feet.' },
  { q: 'Which one flies in the sky?', a: ['airplane', '✈️'], d: [['car', '🚗'], ['boat', '⛵'], ['bus', '🚌']], why: 'An airplane flies. The others stay on land or water.' },
  { q: 'Which one do you use to brush your teeth?', a: ['toothbrush', '🪥'], d: [['fork', '🍴'], ['crayon', '🖍️'], ['key', '🔑']], why: 'You brush your teeth with a toothbrush.' },
  { q: 'Which one gives light in the dark?', a: ['flashlight', '🔦'], d: [['bed', '🛏️'], ['apple', '🍎'], ['book', '📖']], why: 'A flashlight makes light.' },
  { q: 'Which one lives in water?', a: ['fish', '🐟'], d: [['cat', '🐱'], ['bird', '🐦'], ['horse', '🐎']], why: 'A fish lives in water.' },
  { q: 'Which one do you use to open a door?', a: ['key', '🔑'], d: [['spoon', '🥄'], ['crayon', '🖍️'], ['sock', '🧦']], why: 'A key unlocks a door.' },
  { q: 'Which one is cold?', a: ['snowman', '☃️'], d: [['fire', '🔥'], ['sun', '☀️'], ['coffee', '☕']], why: 'A snowman is made of snow, which is cold.' },
  { q: 'Which one do you eat soup with?', a: ['spoon', '🥄'], d: [['scissors', '✂️'], ['pencil', '✏️'], ['crayon', '🖍️']], why: 'Soup is eaten with a spoon.' },
  { q: 'Which one grows on a tree?', a: ['apple', '🍎'], d: [['carrot', '🥕'], ['potato', '🥔'], ['egg', '🥚']], why: 'Apples grow on trees. Carrots and potatoes grow under the ground.' },
  { q: 'Which one do bees make?', a: ['honey', '🍯'], d: [['milk', '🥛'], ['bread', '🍞'], ['cheese', '🧀']], why: 'Bees make honey.' },
  { q: 'Which one helps you see things far away?', a: ['telescope', '🔭'], d: [['microphone', '🎤'], ['hammer', '🔨'], ['book', '📖']], why: 'A telescope makes far things look close.' },
  { q: 'Which one do you put a letter in to mail it?', a: ['envelope', '✉️'], d: [['ball', '⚽'], ['cake', '🎂'], ['shoe', '👟']], why: 'A letter goes in an envelope.' },
  { q: 'Which one has the most legs?', a: ['spider', '🕷️'], d: [['bird', '🐦'], ['dog', '🐶'], ['snake', '🐍']], why: 'A spider has 8 legs. A dog has 4, a bird 2, a snake none.' },
  { q: 'Which one would you wear on a hot, sunny day?', a: ['sunglasses', '🕶️'], d: [['gloves', '🧤'], ['scarf', '🧣'], ['coat', '🧥']], why: 'Sunglasses are for sunny days. The others keep you warm.' },
  { q: 'Which one makes music?', a: ['drum', '🥁'], d: [['chair', '🪑'], ['plate', '🍽️'], ['sock', '🧦']], why: 'You play music on a drum.' },
  { q: 'Which one is the biggest animal?', a: ['whale', '🐳'], d: [['mouse', '🐭'], ['cat', '🐱'], ['ant', '🐜']], why: 'A whale is far bigger than the others.' },
  { q: 'Which one do you paint a picture with?', a: ['paintbrush', '🖌️'], d: [['fork', '🍴'], ['key', '🔑'], ['cup', '🥤']], why: 'You paint with a paintbrush.' },
  { q: 'Which one comes from a chicken?', a: ['egg', '🥚'], d: [['milk', '🥛'], ['honey', '🍯'], ['yarn', '🧶']], why: 'Chickens lay eggs.' },
  { q: 'Which one do you use to sweep the floor?', a: ['broom', '🧹'], d: [['pillow', '🛏️'], ['fork', '🍴'], ['guitar', '🎸']], why: 'A broom sweeps the floor.' },
  { q: 'Which one shows you the way to go?', a: ['map', '🗺️'], d: [['cookie', '🍪'], ['sock', '🧦'], ['drum', '🥁']], why: 'A map shows where places are.' },
  { q: 'Which one has stripes?', a: ['zebra', '🦓'], d: [['elephant', '🐘'], ['frog', '🐸'], ['pig', '🐖']], why: 'A zebra has black and white stripes.' },
  { q: 'Which one do you wear on your head?', a: ['hat', '🎩'], d: [['shoes', '👟'], ['socks', '🧦'], ['gloves', '🧤']], why: 'A hat goes on your head.' },
  { q: 'Which one would you find in the ocean?', a: ['octopus', '🐙'], d: [['camel', '🐫'], ['squirrel', '🐿️'], ['cow', '🐄']], why: 'An octopus lives in the ocean.' },
  { q: 'Which one do you use to build a sandcastle?', a: ['bucket', '🪣'], d: [['pillow', '🛏️'], ['violin', '🎻'], ['book', '📖']], why: 'You fill a bucket with sand to make a sandcastle.' },
  { q: 'Which one is the fastest?', a: ['rocket', '🚀'], d: [['bicycle', '🚲'], ['snail', '🐌'], ['turtle', '🐢']], why: 'A rocket is much faster than the others.' },
  { q: 'Which one do you plant in the ground to grow a flower?', a: ['seed', '🌱'], d: [['rock', '🪨'], ['coin', '🪙'], ['button', '🔘']], why: 'A flower grows from a seed.' },
  { q: 'Which one does a doctor use to listen to your heart?', a: ['stethoscope', '🩺'], d: [['guitar', '🎸'], ['soccer ball', '⚽'], ['crown', '👑']], why: 'A doctor listens to your heart with a stethoscope.' },
  { q: 'Which one do you use to take a picture?', a: ['camera', '📷'], d: [['spoon', '🥄'], ['shoe', '👟'], ['bell', '🔔']], why: 'A camera takes pictures.' },
  { q: 'Which one do you sleep in?', a: ['bed', '🛏️'], d: [['bathtub', '🛁'], ['car', '🚗'], ['chair', '🪑']], why: 'We sleep in a bed.' },
  { q: 'Which one is hot?', a: ['fire', '🔥'], d: [['ice', '🧊'], ['snowflake', '❄️'], ['penguin', '🐧']], why: 'Fire is very hot.' },
  { q: 'Which animal has a long neck?', a: ['giraffe', '🦒'], d: [['pig', '🐖'], ['mouse', '🐭'], ['frog', '🐸']], why: 'A giraffe has a very long neck.' },
  { q: 'Which one do you ring?', a: ['bell', '🔔'], d: [['apple', '🍎'], ['sock', '🧦'], ['leaf', '🍃']], why: 'You ring a bell to make it sound.' },
  { q: 'Which one do you use to wash your hands?', a: ['soap', '🧼'], d: [['candy', '🍬'], ['paint', '🎨'], ['glue', '🧴']], why: 'Soap gets your hands clean.' },
  { q: 'Which one lays eggs?', a: ['hen', '🐔'], d: [['cow', '🐄'], ['dog', '🐶'], ['horse', '🐎']], why: 'A hen lays eggs.' },
  { q: 'Which one has wheels and pedals?', a: ['bicycle', '🚲'], d: [['boat', '⛵'], ['airplane', '✈️'], ['horse', '🐎']], why: 'A bicycle has wheels and pedals.' },
  { q: 'Which one shines in the night sky?', a: ['moon', '🌙'], d: [['rainbow', '🌈'], ['umbrella', '☂️'], ['cloud', '☁️']], why: 'The moon shines at night.' }
];

/** Grade 3: a written sentence with a blank. */
const WORD_SENTENCES: { s: string; a: string; d: string[]; why: string }[] = [
  { s: 'A ___ is a baby dog.', a: 'puppy', d: ['kitten', 'calf', 'lamb', 'cub'], why: 'A baby dog is called a puppy.' },
  { s: 'We wear a warm coat when the weather is ___.', a: 'cold', d: ['hot', 'sandy', 'loud', 'sweet'], why: 'Coats keep us warm, so we wear them when it is cold.' },
  { s: 'The opposite of empty is ___.', a: 'full', d: ['heavy', 'open', 'clean', 'tall'], why: 'Empty means nothing inside; full means it can hold no more.' },
  { s: 'A doctor works in a ___.', a: 'hospital', d: ['library', 'bakery', 'garage', 'stadium'], why: 'Doctors help sick people in a hospital.' },
  { s: 'Ice is frozen ___.', a: 'water', d: ['sand', 'wood', 'smoke', 'air'], why: 'When water gets very cold it freezes into ice.' },
  { s: 'You use your ___ to smell a flower.', a: 'nose', d: ['ears', 'elbow', 'knees', 'hair'], why: 'We smell with our nose.' },
  { s: 'There are seven days in a ___.', a: 'week', d: ['month', 'year', 'minute', 'season'], why: 'A week has seven days.' },
  { s: 'A spider has eight ___.', a: 'legs', d: ['wings', 'tails', 'horns', 'feathers'], why: 'Spiders have eight legs.' },
  { s: 'Plants need sunlight and ___ to grow.', a: 'water', d: ['candy', 'paint', 'noise', 'plastic'], why: 'Plants need light and water to grow.' },
  { s: 'We borrow books from the ___.', a: 'library', d: ['garage', 'pool', 'bakery', 'barn'], why: 'A library lends books.' },
  { s: 'Planes take off and land at an ___.', a: 'airport', d: ['harbor', 'garage', 'station', 'orchard'], why: 'Planes use an airport. Boats use a harbor and trains a station.' },
  { s: 'In the fall, many leaves turn red and ___.', a: 'orange', d: ['blue', 'white', 'black', 'silver'], why: 'Fall leaves turn red, orange and yellow.' },
  { s: 'When you are very tired, you should ___.', a: 'rest', d: ['run', 'shout', 'jump', 'dance'], why: 'Rest helps when you are tired.' },
  { s: 'The sun rises in the morning and sets in the ___.', a: 'evening', d: ['morning', 'noon', 'breakfast', 'winter'], why: 'Sunset is in the evening.' },
  { s: 'A thermometer tells you how hot or ___ it is.', a: 'cold', d: ['loud', 'heavy', 'long', 'early'], why: 'A thermometer measures hot and cold.' },
  { s: 'Fish breathe with their ___.', a: 'gills', d: ['lungs', 'tails', 'noses', 'feathers'], why: 'Fish take oxygen from water with their gills.' },
  { s: 'Bread is baked in an ___.', a: 'oven', d: ['sink', 'fridge', 'closet', 'bathtub'], why: 'An oven gets hot enough to bake bread.' },
  { s: 'You need a ___ to unlock a door.', a: 'key', d: ['coin', 'ruler', 'spoon', 'ribbon'], why: 'A key unlocks a lock.' },
  { s: 'Bees make ___ from the flowers they visit.', a: 'honey', d: ['milk', 'cheese', 'butter', 'bread'], why: 'Bees turn flower nectar into honey.' },
  { s: 'A ___ has four sides that are all the same length.', a: 'square', d: ['circle', 'triangle', 'oval', 'line'], why: 'A square has four equal sides.' },
  { s: 'Ten is ___ than five.', a: 'more', d: ['less', 'smaller', 'fewer', 'shorter'], why: 'Ten is more than five.' },
  { s: 'A caterpillar turns into a ___.', a: 'butterfly', d: ['spider', 'bird', 'worm', 'snail'], why: 'A caterpillar becomes a butterfly.' },
  { s: 'A ___ is a baby cat.', a: 'kitten', d: ['puppy', 'foal', 'chick', 'cub'], why: 'A baby cat is called a kitten.' },
  { s: 'You need a ___ to see the stars up close.', a: 'telescope', d: ['microphone', 'thermometer', 'calendar', 'compass'], why: 'A telescope makes faraway things look close.' },
  { s: 'Water boils when it gets very ___.', a: 'hot', d: ['cold', 'dark', 'quiet', 'thin'], why: 'Water boils when it is heated.' },
  { s: 'A year has twelve ___.', a: 'months', d: ['weeks', 'days', 'hours', 'seasons'], why: 'There are twelve months in a year.' },
  { s: 'A ___ can fly, but it is not a bird.', a: 'bat', d: ['robin', 'eagle', 'owl', 'parrot'], why: 'A bat flies, but it is a mammal, not a bird.' },
  { s: 'We use our ___ to hear music.', a: 'ears', d: ['eyes', 'nose', 'teeth', 'elbows'], why: 'We hear with our ears.' },
  { s: 'Before you cross the street, you should ___ both ways.', a: 'look', d: ['jump', 'sing', 'sleep', 'hide'], why: 'Looking both ways keeps you safe.' },
  { s: 'Snow melts when the weather gets ___.', a: 'warm', d: ['colder', 'windy', 'cloudy', 'dark'], why: 'Warmth melts snow.' },
  { s: 'An apple, a pear and a peach are all kinds of ___.', a: 'fruit', d: ['vegetables', 'nuts', 'bread', 'flowers'], why: 'Apples, pears and peaches are fruits.' },
  { s: 'A ___ tells you which way is north.', a: 'compass', d: ['clock', 'ruler', 'scale', 'thermometer'], why: 'A compass needle points north.' },
  { s: 'A baby grows ___ every year.', a: 'taller', d: ['shorter', 'younger', 'smaller', 'quieter'], why: 'Children grow taller as they get older.' },
  { s: 'The ___ is the closest star to Earth.', a: 'sun', d: ['moon', 'cloud', 'comet', 'rainbow'], why: 'The sun is a star, and it is the closest one to us.' },
  { s: 'A rabbit has long ___ to hear well.', a: 'ears', d: ['tails', 'wings', 'horns', 'claws'], why: 'Rabbits have long ears.' },
  { s: 'We put on ___ to keep our hands warm.', a: 'mittens', d: ['boots', 'goggles', 'belts', 'sandals'], why: 'Mittens keep hands warm.' },
  { s: 'Five plus five equals ___.', a: 'ten', d: ['nine', 'eleven', 'fifteen', 'twenty'], why: '5 + 5 = 10.' },
  { s: 'A firefighter puts out ___.', a: 'fires', d: ['lights', 'candles', 'books', 'boats'], why: 'Firefighters put out fires.' },
  { s: 'Most plants have green ___.', a: 'leaves', d: ['feathers', 'scales', 'wheels', 'shells'], why: 'Leaves are usually green.' },
  { s: 'A turtle carries its ___ on its back.', a: 'shell', d: ['nest', 'egg', 'tail', 'food'], why: 'A turtle has a hard shell on its back.' },
  { s: 'If you are thirsty, you should drink some ___.', a: 'water', d: ['sand', 'soap', 'paint', 'glue'], why: 'Water helps when you are thirsty.' },
  { s: 'The opposite of whisper is ___.', a: 'shout', d: ['listen', 'sleep', 'smile', 'walk'], why: 'A whisper is very quiet; a shout is very loud.' },
  { s: 'You can see your own face in a ___.', a: 'mirror', d: ['pillow', 'blanket', 'basket', 'drawer'], why: 'A mirror shows your reflection.' },
  { s: 'Monday comes right after ___.', a: 'Sunday', d: ['Tuesday', 'Friday', 'Wednesday', 'Thursday'], why: 'The week goes Sunday, Monday, Tuesday…' }
];

function sentenceScene(line: string, answer: string, why: string, pic?: string) {
  const s = new SceneBuilder(W, H);
  const ls = wrap(line, 34);
  ls.forEach((l, i) => s.add(text(`s${i}`, W / 2, 40 + i * 28, l, { size: 18, weight: 600 })));
  s.step('Listen to the whole sentence. Which answer makes it true?');
  s.add(text('why', W / 2, 40 + ls.length * 28 + 24, wrap(why, 44)[0], { size: 14, fill: 'accent', weight: 600 }));
  s.step(why);
  if (pic) s.add(text('pic', W / 2, 170, pic, { size: 48, pulse: true }));
  ls.forEach((l, i) => l.includes('___') && s.set(`s${i}`, { text: l.replace('___', answer), fill: 'good', pulse: true }));
  if (!line.includes('___')) s.add(text('ans', W / 2, pic ? 205 : 170, answer, { size: 20, weight: 700, fill: 'good' }));
  s.step(`The answer is ${answer}.`, { reveal: true });
  return s.build();
}

export const sentenceCompletion: Topic = {
  id: 'cogat-sentences',
  title: 'Sentence completion',
  category: 'Verbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'Listen to (or read) the whole sentence first. Then try each answer in it and keep the one that makes the sentence true and sensible.',
    tips: ['Say the sentence again with your answer in it.', 'Cross out answers that are silly or not true.', 'Little words matter: "most", "not", "opposite".'],
    traps: ['Picking a word that sounds nice but makes the sentence untrue.']
  },
  generate: ({ grade, rng }) => retry(() => {
    if (grade === 2) {
      const it = rng.pick(PICTURE_SENTENCES);
      const m = mc(rng, it.a, rng.shuffle(it.d), choicesFor(grade), (x) => x[0], (x) => x[0], (x) => x[1]);
      if (!m) return null;
      return {
        text: it.q.replace(/^(Which (?:one|animal)) (.+)\?$/, '$1 **$2**?'), // the condition that picks the answer
        speech: it.q,
        answer: m.answer,
        hints: ['Try each picture with the question.', it.why.split('.')[0] + '.'],
        steps: [it.why],
        scene: sentenceScene(it.q, it.a[0], it.why, it.a[1])
      };
    }
    const it = rng.pick(WORD_SENTENCES);
    const m = mc(rng, it.a, rng.shuffle(it.d), choicesFor(grade), (x) => x, (x) => x);
    if (!m) return null;
    return {
      text: it.s.replace('___', '**______**'), // the blank to fill
      speech: it.s.replace('___', 'blank'),
      answer: m.answer,
      hints: ['Read the sentence with each word in the blank.', 'Which one makes the sentence true?'],
      steps: [it.why, `Answer: ${it.a}.`],
      scene: sentenceScene(it.s, it.a, it.why)
    };
  })
};

/* ======================= classification ======================= */

/** [word, picture ('' = word only), tags] */
type Item = [string, string, string[]];
const ITEMS: Item[] = [
  ...(['apple 🍎', 'banana 🍌', 'grapes 🍇', 'strawberry 🍓', 'pear 🍐', 'cherries 🍒', 'watermelon 🍉', 'lemon 🍋'].map((s) => [...s.split(' '), ['fruit', 'food', 'plant']]) as Item[]),
  ['orange', '🍊', ['fruit', 'food', 'plant', 'colour']],
  ...(['carrot 🥕', 'broccoli 🥦', 'corn 🌽', 'potato 🥔', 'cucumber 🥒'].map((s) => [...s.split(' '), ['vegetable', 'food', 'plant']]) as Item[]),
  ...(['car 🚗', 'bus 🚌', 'bicycle 🚲', 'train 🚂', 'truck 🚚', 'tractor 🚜'].map((s) => [...s.split(' '), ['vehicle', 'wheels']]) as Item[]),
  ...(['airplane ✈️', 'helicopter 🚁', 'rocket 🚀'].map((s) => [...s.split(' '), ['vehicle', 'flies']]) as Item[]),
  ...(['sailboat ⛵', 'ship 🚢', 'canoe 🛶'].map((s) => [...s.split(' '), ['vehicle', 'water']]) as Item[]),
  ...(['bird 🐦', 'owl 🦉', 'eagle 🦅', 'bat 🦇', 'parrot 🦜', 'duck 🦆'].map((s) => [...s.split(' '), ['animal', 'flies']]) as Item[]),
  ...(['butterfly 🦋', 'bee 🐝', 'ladybug 🐞', 'beetle 🪲'].map((s) => [...s.split(' '), ['animal', 'flies', 'insect']]) as Item[]),
  ...(['ant 🐜', 'caterpillar 🐛'].map((s) => [...s.split(' '), ['animal', 'insect']]) as Item[]),
  ...(['snake 🐍', 'lizard 🦎'].map((s) => [...s.split(' '), ['animal', 'reptile']]) as Item[]),
  ...(['turtle 🐢', 'crocodile 🐊'].map((s) => [...s.split(' '), ['animal', 'reptile', 'water']]) as Item[]),
  ...(['lion 🦁', 'tiger 🐯', 'elephant 🐘', 'giraffe 🦒', 'zebra 🦓'].map((s) => [...s.split(' '), ['animal', 'wild']]) as Item[]),
  ...(['cake 🎂', 'cookie 🍪', 'donut 🍩', 'cupcake 🧁', 'candy 🍬', 'lollipop 🍭'].map((s) => [...s.split(' '), ['dessert', 'food']]) as Item[]),
  ...(['soccer ⚽', 'basketball 🏀', 'baseball ⚾', 'football 🏈', 'tennis 🎾', 'volleyball 🏐'].map((s) => [...s.split(' '), ['ball']]) as Item[]),
  ...(['rose 🌹', 'tulip 🌷', 'sunflower 🌻', 'daisy 🌼', 'hibiscus 🌺'].map((s) => [...s.split(' '), ['flower', 'plant']]) as Item[]),
  ...(['house 🏠', 'school 🏫', 'hospital 🏥', 'castle 🏰', 'tent ⛺'].map((s) => [...s.split(' '), ['building']]) as Item[]),
  ...(['fish 🐟', 'octopus 🐙', 'crab 🦀', 'dolphin 🐬', 'whale 🐳', 'shark 🦈'].map((s) => [...s.split(' '), ['animal', 'water']]) as Item[]),
  ...(['cow 🐄', 'pig 🐖', 'sheep 🐑', 'horse 🐎', 'goat 🐐'].map((s) => [...s.split(' '), ['animal', 'farm']]) as Item[]),
  ...(['socks 🧦', 'shirt 👕', 'jeans 👖', 'gloves 🧤', 'scarf 🧣', 'dress 👗', 'hat 🎩'].map((s) => [...s.split(' '), ['clothes']]) as Item[]),
  ...(['guitar 🎸', 'drum 🥁', 'trumpet 🎺', 'violin 🎻', 'piano 🎹'].map((s) => [...s.split(' '), ['music']]) as Item[]),
  ...(['sun ☀️', 'rain 🌧️', 'snow ❄️', 'lightning ⚡', 'rainbow 🌈', 'cloud ☁️'].map((s) => [...s.split(' '), ['weather']]) as Item[]),
  ...(['hammer 🔨', 'wrench 🔧', 'saw 🪚', 'screwdriver 🪛'].map((s) => [...s.split(' '), ['tool']]) as Item[]),
  ...(['red', 'blue', 'green', 'yellow', 'purple'].map((w) => [w, '', ['colour']]) as Item[]),
  ...(['circle', 'square', 'triangle', 'rectangle', 'oval'].map((w) => [w, '', ['shape']]) as Item[]),
  ...(['happy', 'sad', 'angry', 'scared', 'excited'].map((w) => [w, '', ['feeling']]) as Item[]),
  ...(['elbow', 'knee', 'nose', 'ear', 'shoulder'].map((w) => [w, '', ['body']]) as Item[]),
  ...(['chair', 'table', 'bed', 'sofa', 'desk'].map((w) => [w, '', ['furniture']]) as Item[]),
  ...(['seven', 'twelve', 'twenty', 'four', 'nine'].map((w) => [w, '', ['number']]) as Item[]),
  ...(['Monday', 'Wednesday', 'Friday', 'Sunday', 'Tuesday'].map((w) => [w, '', ['day']]) as Item[]),
  ...(['January', 'March', 'June', 'October', 'December'].map((w) => [w, '', ['month']]) as Item[]),
  ...(['teacher', 'doctor', 'pilot', 'farmer', 'baker'].map((w) => [w, '', ['job']]) as Item[]),
  ...(['kitchen', 'bedroom', 'bathroom', 'attic', 'basement'].map((w) => [w, '', ['room']]) as Item[]),
  ...(['hop', 'skip', 'jog', 'crawl', 'gallop'].map((w) => [w, '', ['movement']]) as Item[]),
  ...(['Mars', 'Earth', 'Venus', 'Jupiter', 'Saturn'].map((w) => [w, '', ['planet']]) as Item[])
];

const TAG_WORDS: Record<string, string> = {
  fruit: 'fruits', vegetable: 'vegetables', food: 'foods', vehicle: 'things that carry people', wheels: 'things with wheels', flies: 'things that fly', water: 'things found in or on water',
  animal: 'animals', farm: 'farm animals', clothes: 'things you wear', music: 'musical instruments', weather: 'kinds of weather', tool: 'tools', colour: 'colours', shape: 'shapes',
  feeling: 'feelings', body: 'parts of the body', furniture: 'furniture', insect: 'insects', reptile: 'reptiles', wild: 'wild animals', dessert: 'sweet treats',
  ball: 'balls for games', flower: 'flowers', plant: 'plants', building: 'places people stay in', number: 'numbers', day: 'days of the week', month: 'months', job: 'jobs', room: 'rooms in a house',
  movement: 'ways to move', planet: 'planets'
};

function classScene(stim: Item[], ans: Item, tag: string, pics: boolean) {
  const s = new SceneBuilder(W, H);
  const face = (it: Item) => (pics ? it[1] : it[0]);
  const x = (i: number) => 52 + i * 85;
  stim.forEach((it, i) => s.add(rect(`c${i}`, x(i) - 38, 30, 76, 66, { fill: 'fill', stroke: 'line', rx: 10 }), text(`t${i}`, x(i), 63, face(it), { size: pics ? 36 : 15, weight: 600 })));
  s.add(rect('c3', x(3) - 38, 30, 76, 66, { fill: 'fill', stroke: 'line', rx: 10, dash: true }), text('t3', x(3), 63, '?', { size: 26, weight: 700, fill: 'muted' }));
  s.step('How are these three alike?');
  s.setAll('c', { stroke: 'accent', sw: 3 }).set('c3', { stroke: 'line', sw: 1.5 });
  s.add(text('rule', W / 2, 128, `They are all ${TAG_WORDS[tag]}.`, { size: 17, weight: 700, fill: 'accent', pulse: true }));
  s.step(`${stim.map((it) => it[0]).join(', ')}: they are all ${TAG_WORDS[tag]}.`);
  s.set('c3', { stroke: 'good', sw: 3, dash: false }).set('t3', { text: face(ans), fill: pics ? 'ink' : 'good', size: pics ? 36 : 15, pulse: true });
  s.add(text('ans', W / 2, 170, `${ans[0]} is one too`, { size: 16, weight: 700, fill: 'good' }));
  s.step(`The ${ans[0]} is one of the ${TAG_WORDS[tag]} too.`, { reveal: true });
  return s.build();
}

export const classification: Topic = {
  id: 'cogat-classification',
  title: 'Picture & word classification',
  category: 'Verbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'Find a group name for the three things ("they are all fruits", "they all fly"). Then pick the answer that belongs in that group.',
    tips: ['Name the group out loud.', 'Make the group name as exact as you can: "farm animals" is better than "animals".', 'Check that ALL three fit your group.'],
    traps: ['Picking something that goes with just one of the three.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const pics = grade === 2;
    const pool = ITEMS.filter((it) => !pics || it[1]);
    const tags = [...new Set(pool.flatMap((it) => it[2]))].filter((t) => pool.filter((it) => it[2].includes(t)).length >= 4);
    const tag = rng.pick(tags);
    const members = pool.filter((it) => it[2].includes(tag));
    const [a, b, c, ans] = rng.sample(members, 4);
    const stim = [a, b, c];
    const shared = stim[0][2].filter((t) => stim.every((it) => it[2].includes(t)));
    // a wrong answer must not belong to anything all three share
    const wrong = rng.shuffle(pool.filter((it) => !it[2].some((t) => shared.includes(t))));
    // the tightest shared group is the one we explain ("farm animals", not just "animals")
    const best = shared.sort((x, y) => pool.filter((it) => it[2].includes(x)).length - pool.filter((it) => it[2].includes(y)).length)[0];
    if (!ans[2].includes(best)) return null;
    const m = mc(rng, ans, wrong, choicesFor(grade), (it) => it[0], (it) => it[0], pics ? (it) => it[1] : undefined);
    if (!m) return null;
    const figure = pics
      ? svgBox(230, 80, stim.map((it) => it[0]).join(', '), stim.map((it, i) => `<rect x="${6 + i * 76}" y="8" width="66" height="64" rx="10" stroke-width="2"/><text x="${39 + i * 76}" y="54" text-anchor="middle" font-size="40" stroke="none" fill="currentColor">${it[1]}</text>`).join(''))
      : undefined;
    return {
      text: pics ? 'The three pictures **go together**. Which picture **goes with them**?' : `**${stim.map((it) => it[0]).join(', ')}**. Which word goes with these three?`,
      speech: `${stim.map((it) => it[0]).join(', ')}. Which one goes with them?`,
      figure,
      answer: m.answer,
      hints: ['What kind of things are all three?', `They are all ${TAG_WORDS[best]}.`],
      steps: [`${stim.map((it) => it[0]).join(', ')}: all ${TAG_WORDS[best]}.`, `The ${ans[0]} is one too.`],
      scene: classScene(stim, ans, best, pics)
    };
  })
};

export const _test = { RELATIONS, ITEMS, PICTURE_SENTENCES, WORD_SENTENCES };
