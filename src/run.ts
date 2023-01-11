import Executor, { ICompletedTasksCollection, IExecutor, IPerformanceReport, ITaskCollection } from './Executor';
import ITask from './Task';

export default async function run(queue: AsyncIterable<ITask>, maxThreads = 0)
    : Promise<{
        completed: ICompletedTasksCollection
        performance: IPerformanceReport
    }> {
    const executor = new Executor();
    maxThreads = Math.max(0, maxThreads);
    let runningPromises: Promise<void>[] = [];
    executor.start();
    async function toArray(queue: AsyncIterable<ITask>) {
        const arr = [];
        for await (const i of queue) arr.push(i);
        return arr;
    }
    const currentQueue = await toArray(queue)

    while (currentQueue.length > 0) {
        let qIdx = 0;
        while (qIdx < currentQueue.length) {
            const task = currentQueue[qIdx];
            if (maxThreads > 0 && runningPromises.length >= maxThreads) {
                break;
            }
            if (executor.executeData.running[task.targetId]) {
                qIdx++;
            }
            else {
                currentQueue.splice(qIdx, 1);
                const promise = executor.executeTask(task).then(() => {
                    runningPromises = runningPromises.filter(p => p !== promise);
                });
                runningPromises.push(promise);
            }
        }

        await Promise.race(runningPromises);
    }
    await Promise.all(runningPromises);
    executor.stop();
    return {
        completed: executor.executeData.completed,
        performance: executor.performanceReport,
    };
}