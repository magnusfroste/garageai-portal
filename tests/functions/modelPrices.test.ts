import {test,expect} from 'bun:test';
import {modelTierPrice} from '../../supabase/functions/_shared/modelPrices';
const garage={pool_input_cost_per_million:1,pool_output_cost_per_million:2,dedicated_input_cost_per_million:3,dedicated_output_cost_per_million:4};
test('model price overrides apply independently to pool and dedicated, including zero',()=>{expect(modelTierPrice('pool',{poolInput:0,poolOutput:0.6},garage)).toEqual({input:0,output:0.6});expect(modelTierPrice('dedicated',{dedicatedInput:0.15},garage)).toEqual({input:0.15,output:4});});
test('unset model prices retain garage defaults',()=>{expect(modelTierPrice('pool',{},garage)).toEqual({input:1,output:2});});