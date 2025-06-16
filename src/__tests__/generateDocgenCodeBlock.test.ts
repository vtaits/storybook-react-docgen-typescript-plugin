import fs from "node:fs";
import path from "node:path";
import {
  type ParserOptions,
  parse,
} from "react-docgen-typescript/lib/parser.js";
import {
  type GeneratorOptions,
  generateDocgenCodeBlock,
} from "../generateDocgenCodeBlock";

function getGeneratorOptions(parserOptions: ParserOptions = {}) {
  return (filename: string) => {
    const filePath = path.resolve(__dirname, "__fixtures__", filename);

    return {
      filename,
      source: fs.readFileSync(filePath, "utf8"),
      componentDocs: parse(filePath, parserOptions),
      docgenCollectionName: null,
      setDisplayName: true,
      typePropName: "type",
    } as GeneratorOptions;
  };
}

function loadFixtureTests(): GeneratorOptions[] {
  return fs
    .readdirSync(path.resolve(__dirname, "__fixtures__"))
    .map(getGeneratorOptions());
}

const fixtureTests: GeneratorOptions[] = loadFixtureTests();
const simpleFixture = fixtureTests.find(
  (f) => f.filename === "Simple.tsx",
) as GeneratorOptions;

describe("component fixture", () => {
  for (const generatorOptions of fixtureTests) {
    it(`${generatorOptions.filename} has code block generated`, () => {
      expect(generateDocgenCodeBlock(generatorOptions)).toMatchSnapshot();
    });
  }
});

it("adds component to docgen collection", () => {
  expect(
    generateDocgenCodeBlock({
      ...simpleFixture,
      docgenCollectionName: "STORYBOOK_REACT_CLASSES",
    }),
  ).toMatchSnapshot();
});

it("generates value info for enums", () => {
  expect(
    generateDocgenCodeBlock(
      getGeneratorOptions({ shouldExtractLiteralValuesFromEnum: true })(
        "DefaultPropValue.tsx",
      ),
    ),
  ).toMatchSnapshot();
});
