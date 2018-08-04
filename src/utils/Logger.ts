export class Logger {
    public constructor(private name: string) {
    }

    public info(...messages: any[]): void {
        // tslint:disable-next-line:no-console
        console.log(this.prefix("INFO"), ...messages);
    }

    public warn(...messages: any[]): void {
        // tslint:disable-next-line:no-console
        console.log(this.prefix("WARN"), ...messages);
    }
    
    private prefix(level: string): string {
        return level + " - " + this.name + " - " + new Date() + " -";
    }
}