declare module 'xlsx-populate' {
  interface Cell {
    value(): any;
    value(val: any): Cell;
    rowNumber(): number;
    columnNumber(): number;
  }

  interface Range {
    startCell(): Cell;
    endCell(): Cell;
  }

  interface Sheet {
    name(): string;
    cell(row: number, col: number): Cell;
    cell(address: string): Cell;
    usedRange(): Range | undefined;
  }

  interface Workbook {
    sheet(index: number): Sheet;
    sheet(name: string): Sheet;
    sheets(): Sheet[];
  }

  interface FromDataOptions {
    password?: string;
  }

  interface FromFileOptions {
    password?: string;
  }

  function fromDataAsync(data: Buffer | ArrayBuffer, opts?: FromDataOptions): Promise<Workbook>;
  function fromFileAsync(path: string, opts?: FromFileOptions): Promise<Workbook>;
  function fromBlankAsync(): Promise<Workbook>;

  export default {
    fromDataAsync,
    fromFileAsync,
    fromBlankAsync,
  };
}
