struct {
	unsigned char chanVol[4];
	short int     chanDiv[4];
	short int     chanCnt[4];
	
	unsigned short int noiseLFSR;
	unsigned short int noiseTBits;

	char latchedChan;
	char latchedType;//0 tone(noise) 1 volume
} PSG_SN;

struct {
	unsigned char reg[16];
} PSG_AY;

struct {
	unsigned char *data;
	int wait;
	int ptr;
	int ticksPerSample;
	int loopOffset;
	bool play;
} VGM;




void psg_out_port(unsigned char val)
{
	int chan;
	int div;

	if(val&128)
	{
		chan=(val>>5)&3;
		div=(PSG_SN.chanDiv[chan]&0xfff0)|(val&15);

		PSG_SN.latchedChan=chan;
		PSG_SN.latchedType=val&16;
	}
	else
	{
		chan=PSG_SN.latchedChan;
		div=(PSG_SN.chanDiv[chan]&15)|((val&63)<<4);
	}
	
	if(PSG_SN.latchedType)
	{
		PSG_SN.chanVol[chan]=(PSG_SN.chanVol[chan]&16)|(val&15);
	}
	else
	{
		PSG_SN.chanDiv[chan]=div;
		if(chan==3)
		{
			if(((div>>2)&1)) PSG_SN.noiseTBits=9; else PSG_SN.noiseTBits=1;
			PSG_SN.noiseLFSR=0x8000;
		}
	}
}



void ay_out_port(unsigned char reg,unsigned char val)
{
	if(reg<16) PSG_AY.reg[reg]=val;
}



int read_int32(unsigned char *mem)
{
	return (mem[0]+(mem[1]<<8)+(mem[2]<<16)+(mem[3]<<24));
}



//ichan -1 автоматически определить канал, 0..2 тональные каналы, 3 шумовой канал
//noise
bool ImportVGM(int fxn,const char *filename,int ichan,bool inoise)
{
	int samples_per_frame=44100/frame_rate;

	FILE* file=fopen(filename,"rb");

	if(!file) return false;

	fseek(file,0,SEEK_END);
	int size=ftell(file);
	fseek(file,0,SEEK_SET);
	VGM.data=(unsigned char*)malloc(size);
	fread(VGM.data,size,1,file);
	fclose(file);
	
	if(memcmp(VGM.data,"Vgm ",4)!=0)
	{
		Application->MessageBox("No VGM signature found (possibly wrong file type)","Error",MB_OK);
		free(VGM.data);
		return false;
	}

	bool chip_sn=false;
	bool chip_ay=false;

	VGM.wait=0;
	VGM.ptr=read_int32(&VGM.data[0x34])+0x34;

	int snBaseFreq=read_int32(&VGM.data[0x0c]);
	int ayBaseFreq=read_int32(&VGM.data[0x74]);

	if(snBaseFreq>0) chip_sn=true;
	if(ayBaseFreq>0) chip_ay=true;

	if(!chip_sn&&!chip_ay)
	{
		Application->MessageBox("No data for SN/AY found","Error",MB_OK);
		free(VGM.data);
		return false;
	}

	if(chip_ay&&chip_sn) chip_sn=false;

	memset(&PSG_SN,0,sizeof(PSG_SN));
	memset(&PSG_AY,0,sizeof(PSG_AY));

	EffectInit(fxn);

	bool done=false;
	bool eof=false;
	int pd=0;
	int pchan=ichan;

	while(!done)
	{
		int tag=VGM.data[VGM.ptr];

		switch(tag)
		{
		case 0x50:
			psg_out_port(VGM.data[VGM.ptr+1]);
			VGM.ptr+=2;
			break;
		case 0x61:
			VGM.wait+=VGM.data[VGM.ptr+1]+(VGM.data[VGM.ptr+2]<<8);
			VGM.ptr+=3;
			break;
		case 0x62:
			VGM.wait+=735;
			VGM.ptr+=1;
			break;
		case 0x63:
			VGM.wait+=882;
			VGM.ptr+=1;
			break;
		case 0x66:
			done=true;
			eof=true;
			VGM.ptr+=1;
			break;
		case 0xa0:
			ay_out_port(VGM.data[VGM.ptr+1],VGM.data[VGM.ptr+2]);
			VGM.ptr+=3;
			break;
		default:
		if(tag>=0x70&&tag<0x80)
		{
		VGM.wait+=(tag-0x70+1);
		VGM.ptr+=1;
		}
		else
		{
			if(tag>=0x30&&tag<=0x3f) VGM.ptr+=2; else
			if(tag>=0x41&&tag<=0x4e) VGM.ptr+=3; else
			if(tag>=0xc9&&tag<=0xcf) VGM.ptr+=4; else
			if(tag>=0xd7&&tag<=0xdf) VGM.ptr+=4; else
			if(tag>=0xe2) VGM.ptr+=5; else done=true;
			}
		}

		while(VGM.wait>=samples_per_frame)
		{
			VGM.wait-=samples_per_frame;

			int toneDiv=0;
			int noiseDiv=0;
			int outVol=0;
			bool mixT=false;
			bool mixN=false;

			if(chip_sn)
			{
				if(pchan<0)
				{
					if(PSG_SN.chanVol[0]<15) pchan=0; else
					if(PSG_SN.chanVol[1]<15) pchan=1; else
					if(PSG_SN.chanVol[2]<15) pchan=2;
				}

				if(pchan>=0)
				{
					int tvol=15-PSG_SN.chanVol[pchan];
					int nvol=15-PSG_SN.chanVol[3];

					if(!inoise)
					{
						nvol=0;
					}
					else
					{
						switch(PSG_SN.chanDiv[3]&3)
						{
						case 0: noiseDiv=0x1f; break;
						case 1: noiseDiv=0x19; break;
						case 2: noiseDiv=0x10; break;
						case 3:
							noiseDiv=PSG_SN.chanDiv[2]>>1;
							if(noiseDiv>63) noiseDiv=63;
							break;
						}
					}

					outVol=tvol;

					if(nvol>tvol) outVol=nvol;

					int frq=100;

					if(PSG_SN.chanDiv[pchan]>0) frq=snBaseFreq/(PSG_SN.chanDiv[pchan]*16);

					toneDiv=AY_CLOCK/8/frq;

					if(toneDiv<0) toneDiv=0;
					if(toneDiv>4095) toneDiv=4095;

					mixT=tvol?true:false;
					mixN=nvol?true:false;
				}
			}

			if(chip_ay)
			{
				if(pchan<0)
				{
					if(PSG_AY.reg[8]&15) pchan=0; else
					if(PSG_AY.reg[9]&15) pchan=1; else
					if(PSG_AY.reg[10]&15) pchan=2;
				}

				if(pchan>=0)
				{
					toneDiv=PSG_AY.reg[pchan*2+0]|(PSG_AY.reg[pchan*2+1]<<8);
					noiseDiv=PSG_AY.reg[6];
					outVol=PSG_AY.reg[8+pchan]&15;
					mixT=PSG_AY.reg[7]&(0x01<<pchan)?false:true;
					mixN=PSG_AY.reg[7]&(0x08<<pchan)?false:true;
				}
			}

			ayBank[fxn].ayEffect[pd].tone=toneDiv;
			ayBank[fxn].ayEffect[pd].noise=noiseDiv;
			ayBank[fxn].ayEffect[pd].volume=outVol;
			ayBank[fxn].ayEffect[pd].t=mixT;
			ayBank[fxn].ayEffect[pd].n=mixN;

			++pd;

			if(pd>=4096) done=true;
		}
	}

	if(VGM.data) free(VGM.data);
	
	return eof;
}
