// unused

// import { Union } from "./utilityTypes";

export type CssNamedColor = |
  'aliceblue' |
  'antiquewhite' |
  'aqua' |
  'aquamarine' |
  'azure' |
  'beige' |
  'bisque' |
  'black' |
  'blanchedalmond' |
  'blue' |
  'blueviolet' |
  'brown' |
  'burlywood' |
  'cadetblue' |
  'chartreuse' |
  'chocolate' |
  'coral' |
  'cornflowerblue' |
  'cornsilk' |
  'crimson' |
  'cyan' |
  'darkblue' |
  'darkcyan' |
  'darkgoldenrod' |
  'darkgray' |
  'darkgreen' |
  'darkgrey' |
  'darkkhaki' |
  'darkmagenta' |
  'darkolivegreen' |
  'darkorange' |
  'darkorchid' |
  'darkred' |
  'darksalmon' |
  'darkseagreen' |
  'darkslateblue' |
  'darkslategray' |
  'darkslategrey' |
  'darkturquoise' |
  'darkviolet' |
  'deeppink' |
  'deepskyblue' |
  'dimgray' |
  'dimgrey' |
  'dodgerblue' |
  'firebrick' |
  'floralwhite' |
  'forestgreen' |
  'fuchsia' |
  'gainsboro' |
  'ghostwhite' |
  'gold' |
  'goldenrod' |
  'gray' |
  'green' |
  'greenyellow' |
  'grey' |
  'honeydew' |
  'hotpink' |
  'indianred' |
  'indigo' |
  'ivory' |
  'khaki' |
  'lavender' |
  'lavenderblush' |
  'lawngreen' |
  'lemonchiffon' |
  'lightblue' |
  'lightcoral' |
  'lightcyan' |
  'lightgoldenrodyellow' |
  'lightgray' |
  'lightgreen' |
  'lightgrey' |
  'lightpink' |
  'lightsalmon' |
  'lightseagreen' |
  'lightskyblue' |
  'lightslategray' |
  'lightslategrey' |
  'lightsteelblue' |
  'lightyellow' |
  'lime' |
  'limegreen' |
  'linen' |
  'magenta' |
  'maroon' |
  'mediumaquamarine' |
  'mediumblue' |
  'mediumorchid' |
  'mediumpurple' |
  'mediumseagreen' |
  'mediumslateblue' |
  'mediumspringgreen' |
  'mediumturquoise' |
  'mediumvioletred' |
  'midnightblue' |
  'mintcream' |
  'mistyrose' |
  'moccasin' |
  'navajowhite' |
  'navy' |
  'oldlace' |
  'olive' |
  'olivedrab' |
  'orange' |
  'orangered' |
  'orchid' |
  'palegoldenrod' |
  'palegreen' |
  'paleturquoise' |
  'palevioletred' |
  'papayawhip' |
  'peachpuff' |
  'peru' |
  'pink' |
  'plum' |
  'powderblue' |
  'purple' |
  'red' |
  'rosybrown' |
  'royalblue' |
  'saddlebrown' |
  'salmon' |
  'sandybrown' |
  'seagreen' |
  'seashell' |
  'sienna' |
  'silver' |
  'skyblue' |
  'slateblue' |
  'slategray' |
  'slategrey' |
  'snow' |
  'springgreen' |
  'steelblue' |
  'tan' |
  'teal' |
  'thistle' |
  'tomato' |
  'turquoise' |
  'violet' |
  'wheat' |
  'white' |
  'whitesmoke' |
  'yellow' |
  'yellowgreen';

function convertNamedColorToHex(colorString: CssNamedColor): string {
  switch(colorString) {
    case 'aliceblue': return '#f0f8ff';
    case 'antiquewhite': return '#faebd7';
    case 'aqua': return '#00ffff';
    case 'aquamarine': return '#7fffd4';
    case 'azure': return '#f0ffff';
    case 'beige': return '#f5f5dc';
    case 'bisque': return '#ffe4c4';
    case 'black': return '#000000';
    case 'blanchedalmond': return '#ffebcd';
    case 'blue': return '#0000ff';
    case 'blueviolet': return '#8a2be2';
    case 'brown': return '#a52a2a';
    case 'burlywood': return '#deb887';
    case 'cadetblue': return '#5f9ea0';
    case 'chartreuse': return '#7fff00';
    case 'chocolate': return '#d2691e';
    case 'coral': return '#ff7f50';
    case 'cornflowerblue': return '#6495ed';
    case 'cornsilk': return '#fff8dc';
    case 'crimson': return '#dc143c';
    case 'cyan': return '#00ffff';
    case 'darkblue': return '#00008b';
    case 'darkcyan': return '#008b8b';
    case 'darkgoldenrod': return '#b8860b';
    case 'darkgray': return '#a9a9a9';
    case 'darkgreen': return '#006400';
    case 'darkgrey': return '#a9a9a9';
    case 'darkkhaki': return '#bdb76b';
    case 'darkmagenta': return '#8b008b';
    case 'darkolivegreen': return '#556b2f';
    case 'darkorange': return '#ff8c00';
    case 'darkorchid': return '#9932cc';
    case 'darkred': return '#8b0000';
    case 'darksalmon': return '#e9967a';
    case 'darkseagreen': return '#8fbc8f';
    case 'darkslateblue': return '#483d8b';
    case 'darkslategray': return '#2f4f4f';
    case 'darkslategrey': return '#2f4f4f';
    case 'darkturquoise': return '#00ced1';
    case 'darkviolet': return '#9400d3';
    case 'deeppink': return '#ff1493';
    case 'deepskyblue': return '#00bfff';
    case 'dimgray': return '#696969';
    case 'dimgrey': return '#696969';
    case 'dodgerblue': return '#1e90ff';
    case 'firebrick': return '#b22222';
    case 'floralwhite': return '#fffaf0';
    case 'forestgreen': return '#228b22';
    case 'fuchsia': return '#ff00ff';
    case 'gainsboro': return '#dcdcdc';
    case 'ghostwhite': return '#f8f8ff';
    case 'gold': return '#ffd700';
    case 'goldenrod': return '#daa520';
    case 'gray': return '#808080';
    case 'green': return '#008000';
    case 'greenyellow': return '#adff2f';
    case 'grey': return '#808080';
    case 'honeydew': return '#f0fff0';
    case 'hotpink': return '#ff69b4';
    case 'indianred': return '#cd5c5c';
    case 'indigo': return '#4b0082';
    case 'ivory': return '#fffff0';
    case 'khaki': return '#f0e68c';
    case 'lavender': return '#e6e6fa';
    case 'lavenderblush': return '#fff0f5';
    case 'lawngreen': return '#7cfc00';
    case 'lemonchiffon': return '#fffacd';
    case 'lightblue': return '#add8e6';
    case 'lightcoral': return '#f08080';
    case 'lightcyan': return '#e0ffff';
    case 'lightgoldenrodyellow': return '#fafad2';
    case 'lightgray': return '#d3d3d3';
    case 'lightgreen': return '#90ee90';
    case 'lightgrey': return '#d3d3d3';
    case 'lightpink': return '#ffb6c1';
    case 'lightsalmon': return '#ffa07a';
    case 'lightseagreen': return '#20b2aa';
    case 'lightskyblue': return '#87cefa';
    case 'lightslategray': return '#778899';
    case 'lightslategrey': return '#778899';
    case 'lightsteelblue': return '#b0c4de';
    case 'lightyellow': return '#ffffe0';
    case 'lime': return '#00ff00';
    case 'limegreen': return '#32cd32';
    case 'linen': return '#faf0e6';
    case 'magenta': return '#ff00ff';
    case 'maroon': return '#800000';
    case 'mediumaquamarine': return '#66cdaa';
    case 'mediumblue': return '#0000cd';
    case 'mediumorchid': return '#ba55d3';
    case 'mediumpurple': return '#9370db';
    case 'mediumseagreen': return '#3cb371';
    case 'mediumslateblue': return '#7b68ee';
    case 'mediumspringgreen': return '#00fa9a';
    case 'mediumturquoise': return '#48d1cc';
    case 'mediumvioletred': return '#c71585';
    case 'midnightblue': return '#191970';
    case 'mintcream': return '#f5fffa';
    case 'mistyrose': return '#ffe4e1';
    case 'moccasin': return '#ffe4b5';
    case 'navajowhite': return '#ffdead';
    case 'navy': return '#000080';
    case 'oldlace': return '#fdf5e6';
    case 'olive': return '#808000';
    case 'olivedrab': return '#6b8e23';
    case 'orange': return '#ffa500';
    case 'orangered': return '#ff4500';
    case 'orchid': return '#da70d6';
    case 'palegoldenrod': return '#eee8aa';
    case 'palegreen': return '#98fb98';
    case 'paleturquoise': return '#afeeee';
    case 'palevioletred': return '#db7093';
    case 'papayawhip': return '#ffefd5';
    case 'peachpuff': return '#ffdab9';
    case 'peru': return '#cd853f';
    case 'pink': return '#ffc0cb';
    case 'plum': return '#dda0dd';
    case 'powderblue': return '#b0e0e6';
    case 'purple': return '#800080';
    case 'red': return '#ff0000';
    case 'rosybrown': return '#bc8f8f';
    case 'royalblue': return '#4169e1';
    case 'saddlebrown': return '#8b4513';
    case 'salmon': return '#fa8072';
    case 'sandybrown': return '#f4a460';
    case 'seagreen': return '#2e8b57';
    case 'seashell': return '#fff5ee';
    case 'sienna': return '#a0522d';
    case 'silver': return '#c0c0c0';
    case 'skyblue': return '#87ceeb';
    case 'slateblue': return '#6a5acd';
    case 'slategray': return '#708090';
    case 'slategrey': return '#708090';
    case 'snow': return '#fffafa';
    case 'springgreen': return '#00ff7f';
    case 'steelblue': return '#4682b4';
    case 'tan': return '#d2b48c';
    case 'teal': return '#008080';
    case 'thistle': return '#d8bfd8';
    case 'tomato': return '#ff6347';
    case 'turquoise': return '#40e0d0';
    case 'violet': return '#ee82ee';
    case 'wheat': return '#f5deb3';
    case 'white': return '#ffffff';
    case 'whitesmoke': return '#f5f5f5';
    case 'yellow': return '#ffff00';
    case 'yellowgreen': return '#9acd32';
    default: throw new RangeError(`Invalid CSS preset color ${colorString}`);
  }
}
