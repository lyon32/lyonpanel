// Le caractère < est remplacé par la séquence littérale < pour qu'un texte
// ne puisse jamais fermer la balise script. Les deux antislashs sont voulus :
// avec un seul, JavaScript lit déjà « < » et rien n'est échappé.
export const escapeJsonLd = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
