import { db } from '../models/db.js';
import { generateId } from '../utils/crypto.js';

// Generate 100 varied tasks for Agent Arena
type TaskType = 'math' | 'string' | 'array' | 'fetch' | 'json' | 'logic' | 'crypto';

interface TaskDef {
  type: TaskType;
  name: string;
  payload: any;
  deadline_ms: number;
  base_score: number;
  verification_method: 'exact_match' | 'contains' | 'range';
  expected_result: any;
}

function generateTasks(): TaskDef[] {
  const tasks: TaskDef[] = [];

  // === MATH TASKS (1-25) ===
  for (let i = 1; i <= 25; i++) {
    const a = Math.floor(Math.random() * 100) + 1;
    const b = Math.floor(Math.random() * 100) + 1;
    const c = Math.floor(Math.random() * 50) + 1;
    
    const mathTypes = ['sum', 'multiply', 'factorial', 'fibonacci', 'power', 'gcd', 'lcm'];
    const mathType = mathTypes[i % mathTypes.length];
    
    let payload: any;
    let expected: any;
    let verification: 'exact_match' | 'contains' | 'range' = 'exact_match';
    let deadline = 2000;
    let score = 1000;

    switch (mathType) {
      case 'sum':
        payload = { operation: 'sum', numbers: [a, b, c] };
        expected = a + b + c;
        break;
      case 'multiply':
        payload = { operation: 'multiply', numbers: [a, b] };
        expected = a * b;
        break;
      case 'factorial':
        const n = Math.min(a % 10 + 3, 8);
        payload = { operation: 'factorial', n };
        expected = factorial(n);
        break;
      case 'fibonacci':
        const fibN = Math.min(a % 15 + 5, 20);
        payload = { operation: 'fibonacci', n: fibN };
        expected = fibonacci(fibN);
        break;
      case 'power':
        const base = Math.min(a % 5 + 2, 9);
        const exp = Math.min(b % 4 + 2, 5);
        payload = { operation: 'power', base, exponent: exp };
        expected = Math.pow(base, exp);
        break;
      case 'gcd':
        payload = { operation: 'gcd', a, b };
        expected = gcd(a, b);
        break;
      case 'lcm':
        payload = { operation: 'lcm', a, b };
        expected = lcm(a, b);
        break;
    }

    tasks.push({
      type: 'math',
      name: `math_${mathType}_${i}`,
      payload,
      deadline_ms: deadline,
      base_score: score,
      verification_method: verification,
      expected_result: expected
    });
  }

  // === STRING TASKS (26-50) ===
  const words = ['apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon', 'grape', 'honey', 'ice', 'jungle', 'kite', 'lemon', 'mango', 'neon', 'ocean', 'panda', 'queen', 'robot', 'snake', 'tiger', 'unicorn', 'viper', 'wolf', 'xray', 'yacht', 'zebra'];
  const phrases = ['hello world', 'agent arena', 'fastify rocks', 'bun is fast', 'zero claw', 'digital empire', 'code wins', 'ship it', 'keep building', 'never stop'];

  for (let i = 26; i <= 50; i++) {
    const word = words[(i - 26) % words.length];
    const phrase = phrases[(i - 26) % phrases.length];
    const strTypes = ['reverse', 'uppercase', 'length', 'palindrome_check', 'word_count', 'char_count', 'vowel_count', 'concat'];
    const strType = strTypes[(i - 26) % strTypes.length];
    
    let payload: any;
    let expected: any;
    let verification: 'exact_match' | 'contains' | 'range' = 'exact_match';

    switch (strType) {
      case 'reverse':
        payload = { operation: 'reverse', text: word };
        expected = word.split('').reverse().join('');
        break;
      case 'uppercase':
        payload = { operation: 'uppercase', text: word };
        expected = word.toUpperCase();
        break;
      case 'length':
        payload = { operation: 'length', text: phrase };
        expected = phrase.length;
        verification = 'exact_match';
        break;
      case 'palindrome_check':
        const palindrome = i % 2 === 0 ? 'radar' : 'level';
        payload = { operation: 'is_palindrome', text: palindrome };
        expected = true;
        break;
      case 'word_count':
        payload = { operation: 'word_count', text: phrase };
        expected = phrase.split(' ').length;
        break;
      case 'char_count':
        const targetChar = word[0];
        payload = { operation: 'char_count', text: word, char: targetChar };
        expected = word.split(targetChar).length - 1;
        break;
      case 'vowel_count':
        payload = { operation: 'vowel_count', text: word };
        expected = word.match(/[aeiou]/gi)?.length || 0;
        break;
      case 'concat':
        const word2 = words[(i - 26 + 3) % words.length];
        payload = { operation: 'concat', words: [word, word2] };
        expected = word + word2;
        break;
    }

    tasks.push({
      type: 'string',
      name: `string_${strType}_${i}`,
      payload,
      deadline_ms: 1500,
      base_score: 1000,
      verification_method: verification,
      expected_result: expected
    });
  }

  // === ARRAY TASKS (51-70) ===
  for (let i = 51; i <= 70; i++) {
    const arr = Array.from({ length: 10 }, (_, j) => (j * i) % 50 + 1);
    const arrTypes = ['sum', 'max', 'min', 'reverse', 'sort_asc', 'unique_count', 'avg', 'find_index'];
    const arrType = arrTypes[(i - 51) % arrTypes.length];
    
    let payload: any;
    let expected: any;

    switch (arrType) {
      case 'sum':
        payload = { operation: 'array_sum', array: arr };
        expected = arr.reduce((a, b) => a + b, 0);
        break;
      case 'max':
        payload = { operation: 'array_max', array: arr };
        expected = Math.max(...arr);
        break;
      case 'min':
        payload = { operation: 'array_min', array: arr };
        expected = Math.min(...arr);
        break;
      case 'reverse':
        payload = { operation: 'array_reverse', array: arr };
        expected = [...arr].reverse();
        break;
      case 'sort_asc':
        payload = { operation: 'array_sort_asc', array: arr };
        expected = [...arr].sort((a, b) => a - b);
        break;
      case 'unique_count':
        payload = { operation: 'array_unique_count', array: [...arr, ...arr.slice(0, 3)] };
        expected = new Set([...arr, ...arr.slice(0, 3)]).size;
        break;
      case 'avg':
        payload = { operation: 'array_avg', array: arr };
        expected = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        break;
      case 'find_index':
        const target = arr[3];
        payload = { operation: 'array_find_index', array: arr, target };
        expected = arr.indexOf(target);
        break;
    }

    tasks.push({
      type: 'array',
      name: `array_${arrType}_${i}`,
      payload,
      deadline_ms: 2000,
      base_score: 1000,
      verification_method: 'exact_match',
      expected_result: expected
    });
  }

  // === JSON TASKS (71-85) ===
  for (let i = 71; i <= 85; i++) {
    const jsonTypes = ['extract_field', 'count_keys', 'flatten', 'deep_value'];
    const jsonType = jsonTypes[(i - 71) % jsonTypes.length];
    
    let payload: any;
    let expected: any;

    switch (jsonType) {
      case 'extract_field':
        payload = { 
          operation: 'extract_field', 
          data: { name: 'Agent' + i, level: i % 10, active: true },
          field: 'level'
        };
        expected = i % 10;
        break;
      case 'count_keys':
        const keys = ['a', 'b', 'c', 'd', 'e'].slice(0, (i % 5) + 1);
        const obj: any = {};
        keys.forEach(k => obj[k] = k + '_value');
        payload = { operation: 'count_keys', data: obj };
        expected = keys.length;
        break;
      case 'flatten':
        const nested = [[1, 2], [3, 4], [5, 6]];
        payload = { operation: 'flatten', data: nested };
        expected = [1, 2, 3, 4, 5, 6];
        break;
      case 'deep_value':
        payload = {
          operation: 'deep_value',
          data: { user: { profile: { score: i * 10 } } },
          path: 'user.profile.score'
        };
        expected = i * 10;
        break;
    }

    tasks.push({
      type: 'json',
      name: `json_${jsonType}_${i}`,
      payload,
      deadline_ms: 1500,
      base_score: 1000,
      verification_method: 'exact_match',
      expected_result: expected
    });
  }

  // === LOGIC TASKS (86-95) ===
  for (let i = 86; i <= 95; i++) {
    const logicTypes = ['fizzbuzz', 'prime_check', 'leap_year', 'binary_convert', 'encode'];
    const logicType = logicTypes[(i - 86) % logicTypes.length];
    
    let payload: any;
    let expected: any;

    switch (logicType) {
      case 'fizzbuzz':
        const fbN = i;
        payload = { operation: 'fizzbuzz', n: fbN };
        expected = fbN % 15 === 0 ? 'FizzBuzz' : fbN % 3 === 0 ? 'Fizz' : fbN % 5 === 0 ? 'Buzz' : fbN.toString();
        break;
      case 'prime_check':
        const primeN = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29][i - 86];
        payload = { operation: 'is_prime', n: primeN };
        expected = true;
        break;
      case 'leap_year':
        const year = 2000 + (i - 86) * 4;
        payload = { operation: 'is_leap_year', year };
        expected = year % 4 === 0;
        break;
      case 'binary_convert':
        const num = i;
        payload = { operation: 'to_binary', n: num };
        expected = num.toString(2);
        break;
      case 'encode':
        const encodeStr = 'hello';
        payload = { operation: 'base64_encode', text: encodeStr };
        expected = Buffer.from(encodeStr).toString('base64');
        break;
    }

    tasks.push({
      type: 'logic',
      name: `logic_${logicType}_${i}`,
      payload,
      deadline_ms: 2000,
      base_score: 1000,
      verification_method: 'exact_match',
      expected_result: expected
    });
  }

  // === FETCH/COMPLEX TASKS (96-100) ===
  const fetchTasks = [
    {
      name: 'fetch_coin_price',
      payload: { type: 'fetch', url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', extract: 'bitcoin.usd' },
      deadline: 5000,
      verification: 'contains',
      expected: 'bitcoin'
    },
    {
      name: 'fetch_eth_gas',
      payload: { type: 'fetch', url: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle', extract: 'result.ProposeGasPrice' },
      deadline: 5000,
      verification: 'range',
      expected: { min: 1, max: 500 }
    },
    {
      name: 'heavy_compute',
      payload: { type: 'compute', operation: 'sum_range', start: 1, end: 1000000 },
      deadline: 10000,
      verification: 'exact_match',
      expected: 500000500000 // sum of 1 to 1000000
    },
    {
      name: 'sort_large_array',
      payload: { type: 'compute', operation: 'sort_desc', array: Array.from({length: 10000}, (_, i) => i).reverse() },
      deadline: 8000,
      verification: 'contains',
      expected: 9999
    },
    {
      name: 'json_transform',
      payload: { 
        type: 'transform', 
        input: { users: Array.from({length: 100}, (_, i) => ({ id: i, name: `User${i}` })) },
        operation: 'count_users'
      },
      deadline: 3000,
      verification: 'exact_match',
      expected: 100
    }
  ];

  fetchTasks.forEach((task, idx) => {
    tasks.push({
      type: 'fetch',
      name: task.name,
      payload: task.payload,
      deadline_ms: task.deadline,
      base_score: 2000, // Higher score for harder tasks
      verification_method: task.verification as any,
      expected_result: task.expected
    });
  });

  return tasks;
}

// Helper functions
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

// Main execution
function main() {
  console.log('🎮 Generating 100 tasks for Agent Arena...\n');

  const tasks = generateTasks();
  
  const insert = db.prepare(`
    INSERT INTO tasks (id, type, payload, deadline_ms, base_score, verification_method, expected_result, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertMany = db.transaction((taskList: TaskDef[]) => {
    for (const task of taskList) {
      insert.run(
        generateId('task'),
        task.type,
        JSON.stringify(task.payload),
        task.deadline_ms,
        task.base_score,
        task.verification_method,
        JSON.stringify(task.expected_result)
      );
    }
  });

  // Clear existing data first (order matters due to FK constraints)
  db.prepare('DELETE FROM runs').run();
  db.prepare('DELETE FROM task_assignments').run();
  db.prepare('DELETE FROM tasks').run();
  
  insertMany(tasks);

  // Count by type
  const counts = db.prepare('SELECT type, COUNT(*) as count FROM tasks GROUP BY type').all();
  
  console.log('✅ Successfully generated 100 tasks!\n');
  console.log('Task distribution:');
  counts.forEach((row: any) => {
    console.log(`  ${row.type.padEnd(10)}: ${row.count} tasks`);
  });
  
  console.log('\n📊 Task breakdown:');
  console.log('  - Math operations (25): sum, multiply, factorial, fibonacci, power, gcd, lcm');
  console.log('  - String operations (25): reverse, uppercase, length, palindrome, word_count, char_count, vowel_count, concat');
  console.log('  - Array operations (20): sum, max, min, reverse, sort, unique_count, avg, find_index');
  console.log('  - JSON operations (15): extract_field, count_keys, flatten, deep_value');
  console.log('  - Logic puzzles (10): fizzbuzz, prime_check, leap_year, binary, base64');
  console.log('  - Complex tasks (5): fetch APIs, heavy compute, large sort, json transform');
  
  console.log('\n🚀 Ready to play! Agents can now:');
  console.log('  1. Register: POST /agent/register');
  console.log('  2. Request task: POST /task/request');
  console.log('  3. Submit result: POST /task/submit');
  console.log('  4. Check leaderboard: GET /leaderboard');
}

main();
