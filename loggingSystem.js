
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
    const Message = `${args.join(' ')}`
    originalConsoleLog(Message);
};

console.error = (...args) => {
    const Message = `${args.join(' ')}`
    originalConsoleError(Message);
};

export const log = console.log;
export const error = console.error;
