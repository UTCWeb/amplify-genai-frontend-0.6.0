/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundImage: {
        'via-[#343541]': 'transparent',  // Override any background-image or background color here
        'to-[#343541]': 'transparent',  // Override any background-image or background color here
      },
      width: {
        '125': '125%',
      },
      transformOrigin: {
        "utcprofile": "transform: scale(.75) translate(50%, 50%);"
      },
      fontFamily: {
        "sans": ["Raleway, sans-serif"],
        "serif": ["Baskervville, Times New Roman, serif"],
        "mono": ["Source Code Pro, Courier New, monospace"],
        "utcbody": ["Raleway, sans-serif"],
        "utcheadings": ["Oswald, sans-serif"],
        "utcquote": ["Georgia, serif"],
        "condensed": ["Barlow Condensed, sans-serif!important"],
      },
      fontWeight: {
        thin: '100',
        hairline: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      colors: {
        "black": "#112e51",
        "blue": {
          "100": "#E7EAEE",
          "200": "#C4CBD4",
          "300": "#A0ABB9",
          "400": "#586D85",
          "500": "#112E51",
          "600": "#0F2949",
          "700": "#071a31",
          "800": "#051228",
          "900": "#0d1625",
          "stripes": "repeating-linear-gradient(-77deg,#0b1e33,#0b1e33 15px,#12263c 15px,#12263c 20px)",
        },
        "neutral": {
          "100": "rgb(255 255 255 / 0.5);",
          "200": "#fff",
          "300": "#888",
          "400": "#fff",
          "500": "#e7eaee",
          "600": "rgb(255 255 255 / 0.2);",
          "700": "#888",
          "800": "#888",
          "900": "#888",
        },
        "gray": {
          "100": "rgb(255 255 255 / 0.9);",
          "200": "#eee",
          "300": "#ddd",
          "400": "#ccc",
          "500": "rgb(255 255 255 / 0.2);",
          "600": "#aaa",
          "700": "#333",
          "800": "#222",
          "900": "#aaa",
        },
        "yellow": {
          "100": "#fff8eb",
          "200": "#ffedcd",
          "300": "#fee2af",
          "400": "#fecd72",
          "500": "#fdb736",
          "600": "#e4e531",
          "700": "#986e20",
          "800": "#725218",
          "900": "#4c3710"
        },
        "teal": {
          "100": "#e6fffa",
          "200": "#b2f5ea",
          "300": "#81e6d9",
          "400": "#4fd1c5",
          "500": "#166484",
          "600": "#319795",
          "700": "#2c7a7b",
          "800": "#285e61",
          "900": "#234e52"
        },
      }
    },
  },
  variants: {
    extend: {
      visibility: ['group-hover'],
    },
  },
  plugins: [require('@tailwindcss/typography')],
};