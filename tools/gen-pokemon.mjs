// Generates data/pokemon/species.json (the central Pokémon database) from the family list below.
// Stats are designer-assigned auto-chess stats from role/tier templates (NOT canonical games base stats).
// Replace/extend species.json with a full dataset later; the server only reads species.json.
import { writeFileSync } from "node:fs";
const ROLE = { // T1 template: hp, atk, armor, mr, speed, range, maxMana, startMana
  Guardian: [835, 47, 37, 22, 0.63, 1, 80, 25], Fighter: [700, 55, 25, 20, 0.85, 1, 60, 0], Caster: [620, 40, 15, 25, 0.65, 3, 90, 30],
  Ranger: [650, 66, 17, 22, 0.78, 3, 70, 20], Assassin: [540, 50, 15, 15, 1.0, 1, 50, 0], Support: [570, 40, 15, 25, 0.7, 3, 70, 20],
};
const HP = [1, 1.1, 1.25, 1.4, 1.55], ATK = [1, 1.2, 1.4, 1.6, 1.8], DEF = [1, 1.1, 1.2, 1.35, 1.5];
const KIND = { Guardian: "shield", Fighter: "strike", Caster: "nova", Ranger: "burst", Assassin: "burst", Support: "heal" };
// id, name, gen, [types], cost, role, signature ability, family stages (base first), flags
const F = [
  ["rattata", "Rattata", 1, ["Normal"], 1, "Assassin", "Hyper Fang", ["rattata", "raticate"]],
  ["geodude", "Geodude", 1, ["Rock", "Ground"], 1, "Guardian", "Rock Blast", ["geodude", "graveler", "golem"]],
  ["magikarp", "Magikarp", 1, ["Water"], 1, "Fighter", "Flail", ["magikarp", "gyarados"]],
  ["machop", "Machop", 1, ["Fighting"], 1, "Fighter", "Karate Chop", ["machop", "machoke", "machamp"]],
  ["caterpie", "Caterpie", 1, ["Bug"], 1, "Support", "String Shot", ["caterpie", "metapod", "butterfree"]],
  ["pidgey", "Pidgey", 1, ["Normal", "Flying"], 1, "Ranger", "Gust", ["pidgey", "pidgeotto", "pidgeot"]],
  ["zubat", "Zubat", 1, ["Poison", "Flying"], 1, "Assassin", "Wing Attack", ["zubat", "golbat", "crobat"]],
  ["oddish", "Oddish", 1, ["Grass", "Poison"], 1, "Support", "Absorb", ["oddish", "gloom", "vileplume"]],
  ["charmander", "Charmander", 1, ["Fire"], 2, "Fighter", "Ember", ["charmander", "charmeleon", "charizard"]],
  ["squirtle", "Squirtle", 1, ["Water"], 2, "Guardian", "Water Gun", ["squirtle", "wartortle", "blastoise"]],
  ["bulbasaur", "Bulbasaur", 1, ["Grass", "Poison"], 2, "Support", "Vine Whip", ["bulbasaur", "ivysaur", "venusaur"]],
  ["pikachu", "Pikachu", 1, ["Electric"], 2, "Ranger", "Thunderbolt", ["pikachu", "raichu"]],
  ["vulpix", "Vulpix", 1, ["Fire"], 2, "Caster", "Flamethrower", ["vulpix", "ninetales"]],
  ["abra", "Abra", 1, ["Psychic"], 2, "Caster", "Psybeam", ["abra", "kadabra", "alakazam"]],
  ["growlithe", "Growlithe", 1, ["Fire"], 2, "Fighter", "Bite", ["growlithe", "arcanine"]],
  ["eevee", "Eevee", 1, ["Normal"], 2, "Support", "Helping Hand", ["eevee"]],
  ["gastly", "Gastly", 1, ["Ghost", "Poison"], 3, "Assassin", "Shadow Ball", ["gastly", "haunter", "gengar"]],
  ["ralts", "Ralts", 3, ["Psychic", "Fairy"], 3, "Caster", "Confusion", ["ralts", "kirlia", "gardevoir"]],
  ["larvitar", "Larvitar", 2, ["Rock", "Ground"], 3, "Fighter", "Stone Edge", ["larvitar", "pupitar", "tyranitar"]],
  ["dratini", "Dratini", 1, ["Dragon"], 3, "Ranger", "Dragon Pulse", ["dratini", "dragonair", "dragonite"]],
  ["riolu", "Riolu", 4, ["Fighting"], 3, "Assassin", "Aura Sphere", ["riolu", "lucario"]],
  ["chansey", "Chansey", 1, ["Normal"], 3, "Support", "Soft-Boiled", ["chansey", "blissey"]],
  ["scyther", "Scyther", 1, ["Bug", "Flying"], 3, "Assassin", "X-Scissor", ["scyther", "scizor"]],
  ["snorlax", "Snorlax", 1, ["Normal"], 3, "Guardian", "Body Slam", ["snorlax"]],
  ["gible", "Gible", 4, ["Dragon", "Ground"], 4, "Fighter", "Dragon Claw", ["gible", "gabite", "garchomp"]],
  ["beldum", "Beldum", 3, ["Steel", "Psychic"], 4, "Guardian", "Meteor Mash", ["beldum", "metang", "metagross"]],
  ["froakie", "Froakie", 6, ["Water"], 4, "Assassin", "Water Shuriken", ["froakie", "frogadier", "greninja"]],
  ["lapras", "Lapras", 1, ["Water", "Ice"], 4, "Support", "Ice Beam", ["lapras"]],
  ["aerodactyl", "Aerodactyl", 1, ["Rock", "Flying"], 4, "Assassin", "Rock Slide", ["aerodactyl"]],
  ["togepi", "Togepi", 2, ["Fairy"], 4, "Support", "Metronome", ["togepi", "togetic", "togekiss"]],
  ["staryu", "Staryu", 1, ["Water"], 4, "Caster", "Surf", ["staryu", "starmie"]],
  ["tentacool", "Tentacool", 1, ["Water", "Poison"], 4, "Guardian", "Sludge Bomb", ["tentacool", "tentacruel"]],
  ["poliwag", "Poliwag", 1, ["Water"], 2, "Support", "Bubble Beam", ["poliwag", "poliwhirl", "politoed"], { weather: "rain" }],
  ["snover", "Snover", 4, ["Grass", "Ice"], 3, "Caster", "Blizzard", ["snover", "abomasnow"], { weather: "snow" }],
  ["bagon", "Bagon", 3, ["Dragon"], 5, "Fighter", "Outrage", ["bagon", "shelgon", "salamence"]],
  ["deino", "Deino", 5, ["Dark", "Dragon"], 5, "Caster", "Dark Pulse", ["deino", "zweilous", "hydreigon"]],
  ["goomy", "Goomy", 6, ["Dragon"], 5, "Guardian", "Dragon Tail", ["goomy", "sliggoo", "goodra"]],
  ["mewtwo", "Mewtwo", 1, ["Psychic"], 5, "Caster", "Psystrike", ["mewtwo"], { legendary: true }],
  ["rayquaza", "Rayquaza", 3, ["Dragon", "Flying"], 5, "Ranger", "Dragon Ascent", ["rayquaza"], { legendary: true }],
];
const EEVEE = [ // branching evolutions; shop never sells them, only an Evolution Stone on Eevee creates them
  ["vaporeon", "Vaporeon", ["Water"], "Support", "Aqua Ring"], ["jolteon", "Jolteon", ["Electric"], "Ranger", "Thunder Shock"],
  ["flareon", "Flareon", ["Fire"], "Fighter", "Fire Fang"], ["espeon", "Espeon", ["Psychic"], "Caster", "Psychic"],
  ["umbreon", "Umbreon", ["Dark"], "Guardian", "Moonlight"], ["leafeon", "Leafeon", ["Grass"], "Assassin", "Leaf Blade"],
  ["glaceon", "Glaceon", ["Ice"], "Caster", "Ice Shard"], ["sylveon", "Sylveon", ["Fairy"], "Support", "Moonblast"],
].map(([id, name, types, role, ability]) => [id, name, 4, types, 2, role, ability, ["eevee", id], { evolutionOnly: true }]);
const spec = [...F, ...EEVEE].map(([id, name, gen, types, cost, role, ability, family, fl = {}]) => {
  const t = ROLE[role], i = cost - 1, r = (n) => Math.round(n * (fl.evolutionOnly ? 1.25 : 1));
  const atk = r(t[1] * ATK[i]), spAtk = r(role === "Caster" || role === "Support" ? atk * 1.25 : atk * 0.8);
  const arm = r(t[2] * DEF[i]), mr = r(t[3] * DEF[i]);
  return {
    id, name, generation: gen, types, cost, rarity: ["Common", "Uncommon", "Rare", "Epic", fl.legendary ? "Legendary" : "Epic"][i], role,
    hp: r(t[0] * HP[i]), attack: atk, spAttack: spAtk, defence: arm, spDefence: mr, speed: t[4], range: t[5], maxMana: t[6], startMana: t[7],
    crit: 0.2, critDamage: 1.5, kind: KIND[role], ability,
    abilityParams: { status: (({ Fire: 'burn', Water: 'slow', Electric: 'paralysis', Grass: 'poison', Ice: 'freeze', Poison: 'poison', Psychic: 'confusion', Fighting: 'flinch', Ghost: 'confusion', Bug: 'slow', Ground: 'slow', Rock: 'flinch', Dark: 'flinch', Fairy: 'sleep' })[types[0]] ?? null), statusChance: 0.5, base: 80 + cost * 30, ad: 1.2 + cost * 0.15, radius: 1.5, shield: 0.12 + cost * 0.02, dur: 3, impact: 0.4, duration: 0.8, reduction: 0.15, buffDuration: 3, splash: 0.5 },
    description: `${ability}: ${KIND[role] === "heal" ? "heals the most injured ally" : KIND[role] === "shield" ? "shields itself, then strikes" : KIND[role] === "nova" ? "area magic damage around the target" : KIND[role] === "burst" ? "burst damage to the target" : "heavy physical strike"}.`,
    evolutionFamily: family[0], evolutionStage: fl.evolutionOnly ? 1 : 0, evolutionLine: fl.evolutionOnly ? [id] : family, evolvesTo: family.slice(1, 2),
    evolutionRequirement: id === "eevee" ? "stone" : family.length > 1 ? "stars" : null,
    ...(id === "eevee" ? { stoneEvolutions: { water_stone: "vaporeon", thunder_stone: "jolteon", fire_stone: "flareon", sun_stone: "espeon", moon_stone: "umbreon", leaf_stone: "leafeon", ice_stone: "glaceon", shiny_stone: "sylveon" } } : {}),
    megaEvolutions: [], regionalForms: [], transformations: [], legendary: !!fl.legendary, mythical: false,
    weather: fl.weather ?? ({ vulpix: "sun", larvitar: "sandstorm" })[id] ?? null,
    evolutionOnly: !!fl.evolutionOnly, poolId: fl.evolutionOnly ? "eevee" : id,
    model: `models/${id}.glb`, portrait: `portraits/${id}.png`,
  };
});
writeFileSync("data/pokemon/species.json", JSON.stringify({ version: 1, note: "Designer-assigned auto-chess stats; extend or replace with a full Gen 1-9 dataset.", species: spec }, null, 1));
console.log(spec.length, "species");
